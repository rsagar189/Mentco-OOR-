// Tests for the scale / safety features. Usage: NEWTEST=on|off node uat_new.js <app.html>
const U=require('./lib');const H=require('./helpers');const {ok}=U;
const {settle,newPage,login,nav,put,confirmModal,addCustomer,addPart,createOrder,createShipment,ord,sleep}=H;
const MODE=process.env.NEWTEST||'on';
const today=new Date();const iso=d=>d.toISOString().slice(0,10);
const ago=m=>{const d=new Date();d.setMonth(d.getMonth()-m);return iso(d);};
function seedOrder(i,date,status,note){
  const o={id:i,customerName:'Seed Co',customerPONo:'SEED-'+i,orderDate:date,buyerName:'B',saved:true,lines:[1,2,3].map(n=>({lineNo:n,partNo:'S-'+n,poQty:10*n,delivered:0,inTransit:0,shipmentType:'Kan-Ban',inTransitDays:10,originalDockDate:date,additionalNotes:note||'seed note '.repeat(12),lineStatus:'Open',shortCloseQty:0}))};
  return U.seedRow('POM_Orders','SEED-'+i,o,MODE==='on'?{Customer:'Seed Co',OrderDate:date+'T00:00:00Z',Status:status}:{});
}
function seedShip(i,date,po){
  const s={id:i,shippingInvoiceNo:'SINV-'+i,dateOfShipping:date,location:'India',saved:true,lines:[{lineNo:1,customerPONo:po,partNo:'S-1',shippedQty:5,deliveryStatus:'Delivered',deliveryDate:date}]};
  return U.seedRow('POM_Shipments','SINV-'+i,s,MODE==='on'?{ShipDate:date+'T00:00:00Z',Status:'Delivered'}:{});
}
(async()=>{
 U.seedMock();const br=await U.launch();const t0=Date.now();
 const APPF=process.argv[2];
 // ---------- seed: recent closed, old closed, old open
 const N_RECENT=2300,N_OLD=60,N_OLDOPEN=5;let id=1;
 for(let i=0;i<N_RECENT;i++)seedOrder(id++,ago(Math.floor(Math.random()*11)),'Closed');
 for(let i=0;i<N_OLD;i++)seedOrder(id++,ago(30+Math.floor(Math.random()*5)),'Closed');
 for(let i=0;i<N_OLDOPEN;i++)seedOrder(id++,ago(36),'Open');
 for(let i=0;i<650;i++)U.seedRow('POM_AuditLog',String(i+1),{id:i+1,type:'order',refId:1,refNo:'SEED-1',timestamp:new Date().toISOString(),userName:'x',userRole:'Admin',action:'Updated',changes:[]});
 for(let i=0;i<1200;i++)seedShip(100000+i,ago(Math.floor(Math.random()*11)),'SEED-'+(1+i%N_RECENT));
 let A=await newPage(br);const t1=Date.now();await login(A,'admin@uat.test','pw');const signIn=Date.now()-t1;
 const total=N_RECENT+N_OLD+N_OLDOPEN;
 const loaded=await A.evaluate(()=>S.orders.length);
 if(MODE==='on'){
  ok('PAG-1',loaded===N_RECENT+N_OLDOPEN,`window: open orders + last 12 months loaded (${loaded}), old closed history not loaded`,`loaded ${loaded}, expected ${N_RECENT+N_OLDOPEN}`);
  const shLoaded=await A.evaluate(()=>S.shipments.length);
  ok('PAG-2',shLoaded===1200,`all ${shLoaded} recent shipments loaded across several pages`);
  ok('PAG-3',(await A.evaluate(()=>S.orders.filter(o=>o.orderDate<'2024').length))>=N_OLDOPEN&&await A.isVisible('#noticeBar'),'old open orders are included and the window notice is shown');
  await nav(A,'orders');ok('HIS-0',await A.isVisible('#histLoadBtn'),'"Load older history" panel is visible on the Orders page');
  const n=await A.evaluate(()=>loadHistory('2000-01-01',addDaysISO(S.window.from,-1)));
  const after=await A.evaluate(()=>S.orders.length);
  ok('HIS-1',n===N_OLD&&after===loaded+N_OLD,`loading history adds exactly the ${N_OLD} older closed orders (now ${after})`,`added ${n}`);
 } else {
  ok('PAG-1',loaded===total,`flags off: all ${loaded} orders loaded in one read`,`loaded ${loaded}`);
 }
 console.log(`   sign-in with ${total} orders, 1200 shipments, 650 audit rows: ${signIn} ms (browser + simulated flow, mode ${MODE})`);
 // ---------- audit paging
 const au=await A.evaluate(()=>({n:S.auditLog.length,more:S.auditMore}));
 ok('AUD-P1',au.n===200&&au.more,`audit log loads only the latest 200 of 650 (${au.n})`);
 if(MODE==='on'){await A.evaluate(async()=>{while(S.auditMore)await loadMoreAudit();});
  const n2=await A.evaluate(()=>S.auditLog.length);ok('AUD-P2',n2===650,`"load older entries" reaches all 650 (${n2}) and stops`);}
 // ---------- version, AI button hidden
 await nav(A,'orders');
 ok('UI-1',!(await A.$('#importDocBtn'))&&!(await A.$('#importShipDocBtn')),'AI import buttons are hidden');
 ok('UI-2',(await A.innerText('body')).includes('v1.1.0'),'version number is shown');
 if(MODE==='on'){
  // ---------- settings: dropdown lists
  await nav(A,'masters');await A.click('[data-master-tab="lists"]');await sleep(200);
  await A.fill('#setLoc','India\nSAT\nUAT-Plant');await A.click('#saveListsBtn');await settle(A);
  const st=U.L('POM_AppState').find(r=>r.Title==='settings');
  ok('SET-1',st&&JSON.parse(st.POM_Data).locations.includes('UAT-Plant'),'dropdown list change saved to SharePoint');
  await A.reload();await settle(A,1200);await sleep(600);
  ok('SET-2',await A.evaluate(()=>LOCATIONS.includes('UAT-Plant')),'new location is back after refresh (no code change)');
  // ---------- save failure banner
  await addCustomer(A,'UAT-Cust F');
  U.FAIL.action='updateItem';U.FAIL.remaining=1;
  await nav(A,'masters');await A.click('[data-master-tab="customers"]');
  const cid=await A.evaluate(()=>S.customers.find(c=>c.name==='UAT-Cust F').id);
  await A.click(`[data-action="editCust"][data-id="${cid}"]`);await A.fill(`#ecc${cid}`,'Fail Test');await A.click(`[data-action="saveCust"][data-id="${cid}"]`);await settle(A,800);await sleep(300);
  ok('SAVE-1',await A.isVisible('#saveBanner'),'a failed save shows a red "NOT saved" banner');
  const before=U.L('POM_Customers').find(r=>r.Title==='UAT-Cust F');ok('SAVE-2',JSON.parse(before.POM_Data).contact!=='Fail Test','nothing half-saved while the flow was down');
  await A.click('#sbRetry');await settle(A,800);await sleep(300);
  const afterR=U.L('POM_Customers').find(r=>r.Title==='UAT-Cust F');
  ok('SAVE-3',!(await A.isVisible('#saveBanner').catch(()=>false))&&JSON.parse(afterR.POM_Data).contact==='Fail Test','Retry saves the change and clears the banner');
  // ---------- duplicate PO + over-ship warnings
  await addCustomer(A,'UAT-Cust W');await addPart(A,'UAT-Cust W','UAT-W1','w');
  await createOrder(A,{cust:'UAT-Cust W',po:'UAT-PO-W1',lines:[{part:'UAT-W1',qty:10,us:1,inr:1}]});
  await nav(A,'orders');await A.click('#newOrderBtn');await sleep(250);
  await A.selectOption('[data-f="customerName"]',{label:'UAT-Cust W'});await put(A,'[data-f="customerPONo"]','UAT-PO-W1');await A.click('#wizNextBtn');await sleep(250);
  await A.selectOption('[data-f="lines.0.partNo"]','UAT-W1');await put(A,'[data-f="lines.0.poQty"]','5');await A.click('#wizNextBtn');await sleep(250);await A.click('#saveOrderBtn');await sleep(300);
  ok('WARN-1',(await A.innerText('.modal')).includes('already has a PO numbered'),'duplicate PO number shows a warning before saving');
  await A.click('#modalCancel');await sleep(200);
  await nav(A,'shipments');await A.click('#newShipmentBtn');await sleep(250);await put(A,'[data-sf="shippingInvoiceNo"]','UAT-INV-W');await A.click('#shipWizNextBtn');await sleep(250);
  await A.selectOption('[data-sf="slines.0.customerPONo"]','UAT-PO-W1');await sleep(150);await A.selectOption('[data-sf="slines.0.partNo"]','UAT-W1');await sleep(200);await put(A,'[data-sf="slines.0.shippedQty"]','25');
  const opts=await A.$$eval('[data-sf="slines.0.shippedTo"] option',o=>o.map(x=>x.value));if(opts.length)await A.selectOption('[data-sf="slines.0.shippedTo"]',opts[0]).catch(()=>{});
  await A.click('#shipWizNextBtn');await sleep(250);await A.click('#saveShipBtn');await sleep(300);
  ok('WARN-2',(await A.innerText('.modal')).includes('Over-shipping'),'shipping more than ordered shows a warning before saving');
  await A.click('#modalCancel');await sleep(200);
  // ---------- status column follows shipments
  await createShipment(A,{inv:'UAT-INV-W2',lines:[{po:'UAT-PO-W1',part:'UAT-W1',qty:10,status:'Delivered'}]});await settle(A,1200);await sleep(500);
  const orow=U.L('POM_Orders').find(r=>r.Title==='UAT-PO-W1');
  ok('COL-1',orow&&orow.Status==='Closed','order Status column switches to Closed when its last shipment is delivered',orow&&orow.Status);
  // ---------- two people, same record (conflict)
  await createOrder(A,{cust:'UAT-Cust W',po:'UAT-PO-C1',lines:[{part:'UAT-W1',qty:3,us:1,inr:1}]});await settle(A,1000);
  const B=await newPage(br);await login(B,'admin@uat.test','pw');
  await B.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='UAT-PO-C1');o.lines[0].additionalNotes='by B';return spSaveOrder(o);});await settle(B);
  await A.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='UAT-PO-C1');o.lines[0].additionalNotes='by A';persist(()=>spSaveOrder(o),'order UAT-PO-C1');});await settle(A,1000);await sleep(300);
  ok('CON-1',await A.isVisible('#saveBanner')&&(await A.innerText('#saveBanner')).includes('Someone else changed'),'second person saving the same order gets a "someone else changed it" banner');
  ok('CON-2',JSON.parse(U.L('POM_Orders').find(r=>r.Title==='UAT-PO-C1').POM_Data).lines[0].additionalNotes==='by B','the first person\'s change was not overwritten silently');
  await A.click('#sbOver');await settle(A,1000);await sleep(300);
  ok('CON-3',JSON.parse(U.L('POM_Orders').find(r=>r.Title==='UAT-PO-C1').POM_Data).lines[0].additionalNotes==='by A'&&!(await A.isVisible('#saveBanner').catch(()=>false)),'"Overwrite with my version" saves it and clears the banner');
 }
 const f=U.results.filter(r=>!r.pass);
 console.log(`\n=== NEW FEATURES (${MODE}): ${U.results.length-f.length} passed, ${f.length} failed (${Math.round((Date.now()-t0)/1000)}s) ===`);
 await br.close();process.exit(0);
})().catch(e=>{console.error('RUNNER ERROR',e.stack||e.message);process.exit(2);});
