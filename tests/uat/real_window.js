// Real-system test of the 12-month window, history loading and "Rebuild search columns" (needs FLOW_QUERY + USE_COLUMNS on)
const U=require('./lib');const H=require('./helpers');const {ok}=U;const sleep=H.sleep;
const E=process.env.POM_UAT_ADMIN_EMAIL,P=process.env.POM_UAT_ADMIN_PASSWORD;
const ago=m=>{const d=new Date();d.setMonth(d.getMonth()-m);d.setDate(10);return d.toISOString().slice(0,10);};
let tok=null;
const sp=(a,l,x={})=>{if(!tok){const r=U.gateway({action:'login',listName:'',token:'',email:E.toLowerCase(),passHash:U.HASH(E,P)});tok=r[1].token;}return U.gateway({action:a,listName:l,token:tok,...x});};
const mk=(id,po,date,status,withCols=true)=>({id,customerName:'UAT-Win Co',customerPONo:po,orderDate:date,buyerName:'B',saved:true,_rev:1,lines:[{lineNo:1,partNo:'W1',poQty:10,delivered:status==='Closed'?10:0,inTransit:0,shipmentType:'Kan-Ban',inTransitDays:10,originalDockDate:date,additionalNotes:'window test',lineStatus:'Open',shortCloseQty:0}]});
const created=[];
const add=(list,title,data,cols)=>{const r=sp('createItem',list,{Title:title,POM_Data:JSON.stringify(data),...(cols?{Cols:JSON.stringify(cols)}:{})});if(r[0]!==200)throw new Error('seed failed '+list+' '+r[0]+' '+JSON.stringify(r[1]).slice(0,150));created.push([list,r[1].Id??r[1].ID]);return r[1].Id??r[1].ID;};
const purge=()=>{for(const l of ['POM_Orders','POM_Shipments','POM_Finance','POM_Customers']){const r=sp('getItems',l,{query:'$top=500'});for(const i of (r[1].value||[]))if(/UAT-/.test(i.POM_Data||'')||/^UAT-/.test(i.Title||''))sp('deleteItem',l,{itemId:i.Id??i.ID});}};
(async()=>{
 purge();
 const base=900000;
 const oldClosed=[1,2,3].map(i=>{const d=ago(30+i);add('POM_Orders','UAT-OLDC-'+i,mk(base+i,'UAT-OLDC-'+i,d,'Closed'),{Customer:'UAT-Win Co',OrderDate:d+'T00:00:00Z',Status:'Closed'});return 'UAT-OLDC-'+i;});
 const dOpen=ago(18);add('POM_Orders','UAT-OLDO-1',mk(base+10,'UAT-OLDO-1',dOpen,'Open'),{Customer:'UAT-Win Co',OrderDate:dOpen+'T00:00:00Z',Status:'Open'});
 add('POM_Shipments','UAT-OLDO-SHIP',{id:base+50,shippingInvoiceNo:'UAT-OLDO-SHIP',dateOfShipping:ago(17),location:'India',saved:true,_rev:1,lines:[{lineNo:1,customerPONo:'UAT-OLDO-1',partNo:'W1',shippedQty:4,deliveryStatus:'In Transit'}]},{ShipDate:ago(17)+'T00:00:00Z',Status:'In Transit'});
 add('POM_Finance','UAT-OLDO-1',{id:base+10,rates:[{us:9,in:8}]},{OrderDate:dOpen+'T00:00:00Z'});
 [1,2].forEach(i=>{const d=ago(2);add('POM_Orders','UAT-REC-'+i,mk(base+20+i,'UAT-REC-'+i,d,'Closed'),{Customer:'UAT-Win Co',OrderDate:d+'T00:00:00Z',Status:'Closed'});});
 // a legacy order saved WITHOUT search columns (as before the upgrade)
 const dLeg=ago(1);add('POM_Orders','UAT-LEGACY-1',mk(base+30,'UAT-LEGACY-1',dLeg,'Open'),null);
 const br=await U.launch();const pg=await H.newPage(br);await H.login(pg,E,P);
 const have=po=>pg.evaluate(po=>S.orders.some(o=>o.customerPONo===po),po);
 ok('WIN-1',await have('UAT-REC-1')&&await have('UAT-REC-2'),'recent orders (last 12 months) are loaded at sign-in');
 ok('WIN-2',await have('UAT-OLDO-1'),'an 18-month-old order that is still OPEN is loaded');
 ok('WIN-3',!(await have('UAT-OLDC-1'))&&!(await have('UAT-OLDC-3')),'old CLOSED orders are not loaded at sign-in');
 ok('WIN-4',!(await have('UAT-LEGACY-1')),'an order without search columns is not found by the window (expected until columns are rebuilt)');
 const o=await pg.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='UAT-OLDO-1');return o&&{inT:o.lines[0].inTransit,us:o.lines[0].usRate};});
 ok('WIN-5',o&&o.inT===4&&o.us===9,'the old open order still gets its in-transit quantity (4) and its rates (9) from further back',JSON.stringify(o));
 await H.nav(pg,'orders');ok('WIN-6',await pg.isVisible('#histLoadBtn'),'"Load older history" panel is shown');
 const before=await pg.evaluate(()=>S.orders.length);
 await pg.fill('#histFrom','2000-01-01');await pg.fill('#histTo',ago(11));await pg.click('#histLoadBtn');await H.settle(pg,1500);await sleep(600);
 ok('WIN-7',await have('UAT-OLDC-1')&&await have('UAT-OLDC-2')&&await have('UAT-OLDC-3'),'Load older history brings in the 3 old closed orders',String((await pg.evaluate(()=>S.orders.length))-before));
 // rebuild search columns for the legacy order: it needs to be loaded first -> load its month range, then rebuild
 await pg.evaluate(()=>loadHistory(addDaysISO(cutoffISO(0),-80),addDaysISO(cutoffISO(0),0))); // pulls recent range again (dedupes)
 // the legacy row has no OrderDate column so a date filter cannot find it: load it by id through the same app function instead
 const legRows=sp('getItems','POM_Orders',{query:"$top=5&$filter=Title eq 'UAT-LEGACY-1'"})[1].value;
 await pg.evaluate(r=>{const rec={...spDeserialize(r),_spId:rowId(r),_colStatus:r.Status};S.orders.push(rec);},legRows[0]);
 await H.nav(pg,'masters');await pg.click('[data-master-tab="lists"]');await sleep(300);
 ok('WIN-8',await pg.isVisible('#rebuildColsBtn'),'Maintenance → "Rebuild search columns" is available');
 await pg.click('#rebuildColsBtn');await H.settle(pg,2000);await sleep(2000);
 const leg=sp('getItems','POM_Orders',{query:"$top=5&$filter=Title eq 'UAT-LEGACY-1'"})[1].value[0];
 ok('WIN-9',leg&&leg.Status==='Open'&&String(leg.OrderDate||'').slice(0,10)===dLeg&&leg.Customer==='UAT-Win Co','Rebuild fills the Customer / OrderDate / Status columns of the legacy order',JSON.stringify({s:leg&&leg.Status,d:leg&&leg.OrderDate}));
 // Status follows shipments: deliver the old open order's shipment fully -> Status column becomes Closed
 const failed=await pg.evaluate(()=>SAVE.failed.length);ok('WIN-10',failed===0,'no failed saves during the rebuild',String(failed));
 await pg.click('#logoutBtn');await H.settle(pg);
 purge();
 const left=[];for(const l of ['POM_Orders','POM_Shipments','POM_Finance','POM_Customers'])for(const i of (sp('getItems',l,{query:'$top=500'})[1].value||[]))if(/UAT-/.test(i.POM_Data||'')||/^UAT-/.test(i.Title||''))left.push(l+':'+i.Title);
 ok('WIN-CLEAN',left.length===0,'test data removed',JSON.stringify(left));
 sp('logout','');
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== REAL WINDOW TEST: ${U.results.length-f.length} passed, ${f.length} failed ===`);
 await br.close();process.exit(0);
})().catch(e=>{console.error('RUNNER ERROR',String(e.stack||e.message).split(process.env.POM_FLOW_URL||'\u0000').join('<flow-url>'));try{purge()}catch{};process.exit(2);});
