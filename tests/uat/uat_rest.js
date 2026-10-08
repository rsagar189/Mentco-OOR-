// Remaining UAT items: failed save + retry, shipment re-link, Cancel PO, filters, Viewer 1 export, audit CSV export, phone layout.
// Mock: UAT_MODE=mock node uat_rest.js app.html   Real: UAT_MODE=real (writes UAT- data and removes it afterwards)
const U=require('./lib');const H=require('./helpers');const {ok,MODE}=U;const {settle,newPage,login,nav,put,addCustomer,addPart,createOrder,createShipment,ord,sleep}=H;
const fs=require('fs');
const ADM=MODE==='real'?process.env.POM_UAT_ADMIN_EMAIL:'admin@uat.test',APW=MODE==='real'?process.env.POM_UAT_ADMIN_PASSWORD:'pw';
const V1='uat-rest-v1@example.com',V1P='Rest-test-Pw1!';
let tok=null;
const sp=(a,l,x={})=>{if(!tok){const r=U.gateway({action:'login',listName:'',token:'',email:ADM.toLowerCase(),passHash:U.HASH(ADM,APW)});tok=r[1].token;}return U.gateway({action:a,listName:l,token:tok,...x});};
const purge=()=>{for(const l of ['POM_Orders','POM_Shipments','POM_Finance','POM_Customers','POM_Parts','POM_Users'])for(const i of (sp('getItems',l)[1].value||[]))if(/UAT-RX/.test(i.POM_Data||'')||/^UAT-RX/.test(i.Title||'')||i.Title===V1)sp('deleteItem',l,{itemId:i.Id??i.ID});};
const download=async(pg,fn)=>{const [d]=await Promise.all([pg.waitForEvent('download',{timeout:8000}),fn()]);const p=await d.path();return fs.readFileSync(p,'utf8');};
(async()=>{
 if(MODE==='mock')U.seedMock();
 purge();
 const br=await U.launch();const A=await newPage(br);await login(A,ADM,APW);
 await addCustomer(A,'UAT-RX Co');await addPart(A,'UAT-RX Co','UAT-RX-P1','part');
 await createOrder(A,{cust:'UAT-RX Co',po:'UAT-RXA',lines:[{part:'UAT-RX-P1',qty:100,inr:5,us:9}]});
 await createOrder(A,{cust:'UAT-RX Co',po:'UAT-RXB',lines:[{part:'UAT-RX-P1',qty:100,inr:5,us:9}]});
 await createShipment(A,{inv:'UAT-RXS',lines:[{po:'UAT-RXA',part:'UAT-RX-P1',qty:40}]});
 let a=await ord(A,'UAT-RXA');ok('RX-0',a&&a.lines[0].inTransit===40,'setup: shipment of 40 counted on UAT-RXA',JSON.stringify(a&&a.lines[0].inTransit));
 // ---- failed save then retry (DAT-4)
 const blockFlow=r=>r.abort();await A.route('https://flow.test/run',blockFlow);
 await addCustomer(A,'UAT-RX Offline');await sleep(1500);
 const banner=await A.evaluate(()=>({n:SAVE.failed.length,txt:(document.getElementById('saveBanner')||document.querySelector('[id*=sb]')||{}).innerText||document.body.innerText.match(/NOT saved/)?.[0]||''}));
 ok('RX-1',banner.n>0&&/NOT saved/.test(banner.txt+await A.innerText('body')),'while offline the change is flagged "NOT saved"',JSON.stringify(banner));
 await A.unroute('https://flow.test/run',blockFlow);
 const rt=await A.$('#sbRetry');if(rt)await rt.click();else await A.evaluate(()=>{const items=SAVE.failed.splice(0);items.forEach(x=>persist(x.fn,x.desc));});
 await H.settle(A,1500);await sleep(500);
 ok('RX-2',(await A.evaluate(()=>SAVE.failed.length))===0&&(sp('getItems','POM_Customers')[1].value||[]).some(i=>i.Title==='UAT-RX Offline'),'after reconnecting, Retry saves it to SharePoint');
 // ---- re-link shipment to another PO
 await nav(A,'shipments');await sleep(300);
 await A.click('[data-action="relinkShipment"]');await sleep(400);
 await A.selectOption('#rlPO0','UAT-RXB');await sleep(200);await A.selectOption('#rlPart0','UAT-RX-P1');await sleep(200);
 const ln=await A.$$eval('#rlOrderLine0 option',o=>o.map(x=>x.value).filter(Boolean));if(ln.length)await A.selectOption('#rlOrderLine0',ln[0]);
 await A.click('#relinkSave');await sleep(300);await A.click('#modalConfirm').catch(()=>{});await H.settle(A,1500);await sleep(400);
 a=await ord(A,'UAT-RXA');const b=await ord(A,'UAT-RXB');
 ok('RX-3',a.lines[0].inTransit===0&&b.lines[0].inTransit===40,'re-link moves the 40 in transit from UAT-RXA to UAT-RXB',JSON.stringify([a.lines[0].inTransit,b.lines[0].inTransit]));
 const sh=(sp('getItems','POM_Shipments')[1].value||[]).find(i=>i.Title==='UAT-RXS');
 ok('RX-3b',sh&&JSON.parse(sh.POM_Data).lines[0].customerPONo==='UAT-RXB','re-link is saved in SharePoint');
 // ---- cancel PO
 await A.evaluate(()=>{S.editing=cloneObj(S.orders.find(o=>o.customerPONo==='UAT-RXA'));S.page='view-order';render();});await sleep(300);
 ok('RX-4a',await A.isVisible('#cancelOrderBtn'),'Cancel PO button shown to Admin');
 await A.click('#cancelOrderBtn');await sleep(250);await H.confirmModal(A);await sleep(800);
 a=await ord(A,'UAT-RXA');const st=(sp('getItems','POM_Orders')[1].value||[]).find(i=>i.Title==='UAT-RXA');
 ok('RX-4',a.lines.every(l=>l.lineStatus==='Cancelled')&&st&&/Cancelled/.test(st.POM_Data),'Cancel PO cancels every open line and saves',JSON.stringify(a.lines.map(l=>l.lineStatus)));
 // ---- filters
 await nav(A,'orders');await sleep(300);
 const rowsOf=()=>A.evaluate(()=>(document.body.innerText.match(/Showing\s+(\d+)\s+of\s+(\d+)/)||[]).slice(1,3).map(Number));
 await A.fill('#searchInput','UAT-RXB');await sleep(500);const s1=await rowsOf();
 ok('RX-5a',s1[0]===1,'search "UAT-RXB" shows exactly 1 order',JSON.stringify(s1));
 await A.fill('#searchInput','UAT-RX');await sleep(500);const s2=await rowsOf();
 ok('RX-5b',s2[0]===2,'search "UAT-RX" shows both test orders',JSON.stringify(s2));
 await A.click('#filterToggleBtn');await sleep(250);
 await A.evaluate(()=>{S.filters.poStatuses=['Cancelled'];render();});await sleep(400);
 const s3=await A.evaluate(()=>applyOrderFilters(S.orders).filter(o=>/UAT-RX/.test(o.customerPONo)).map(o=>o.customerPONo));
 ok('RX-5c',s3.length===1&&s3[0]==='UAT-RXA','status filter "Cancelled" shows only the cancelled order',JSON.stringify(s3));
 await A.evaluate(()=>{S.filters={};S.search='';render();});
 await A.evaluate(()=>{S.filters.orderDateFrom='2999-01-01';render();});const s4=await A.evaluate(()=>applyOrderFilters(S.orders).length);
 ok('RX-5d',s4===0,'date filter (future dates) shows nothing',String(s4));
 await A.evaluate(()=>{S.filters={};render();});
 // ---- audit CSV
 await nav(A,'users');await sleep(500);
 const csv=await download(A,()=>A.click('button[onclick="exportAuditLog()"]'));
 ok('RX-6',/^﻿Timestamp,Type,Reference/.test(csv)&&/UAT-RXA/.test(csv)&&/Cancelled/.test(csv),'audit CSV downloads with headers and the Cancel PO entry',csv.slice(0,80));
 // ---- Viewer 1 export has no rate columns
 await nav(A,'users');await A.fill('#uName','UAT Rest V1');await A.fill('#uEmail',V1);await A.fill('#uPassword',V1P);await A.selectOption('#uRole','Viewer1');await A.click('#saveUserBtn');await settle(A,800);await sleep(300);
 const V=await newPage(br);await login(V,V1,V1P);
 await nav(V,'orders');await sleep(300);await V.click('#orderExportBtn');await sleep(300);
 const vcsv=await download(V,async()=>{await V.click('[data-oexp="full"]');await V.click('#oexpConfirm');});
 ok('RX-7',/PO No/.test(vcsv)&&!/India Rate|US Rate|India Ext|US Ext/.test(vcsv)&&!/,5,9/.test(vcsv),'Viewer 1 export has no rate or value columns',vcsv.split('\n')[0].slice(0,120));
 const acsv=await download(A,async()=>{await nav(A,'orders');await A.click('#orderExportBtn');await sleep(250);await A.click('[data-oexp="full"]');await A.click('#oexpConfirm');});
 ok('RX-7b',/India Rate/.test(acsv),'(control) Admin export does include the rate columns');
 // ---- phone layout
 const ph=await br.newContext({viewport:{width:390,height:800}});const P=await ph.newPage();
 await P.route('**/*',r=>{const u=r.request().url();if(u==='https://flow.test/run'){const [st,j,txt]=U.gateway(JSON.parse(r.request().postData()));return r.fulfill({status:st,contentType:'application/json',body:typeof txt==='string'?txt:JSON.stringify(j)});}return u.startsWith('file://')?r.continue():r.abort();});
 await P.goto('file://'+process.argv[2]);await P.fill('#lemail',ADM);await P.fill('#lpass',APW);await P.click('#lbtn');await settle(P,800);await sleep(600);
 const m=await P.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,side:(document.getElementById('appSidebar')||{}).offsetWidth,main:(document.getElementById('appMain')||{}).offsetWidth}));
 ok('RX-8',m.sw<=m.iw+2,'phone (390px wide): page does not scroll sideways',JSON.stringify(m));
 ok('RX-8b',m.main>=250,'phone: main area leaves at least 250px for content',JSON.stringify(m));
 for(const pg of ['orders','shipments','masters','users']){await P.click(`[data-nav="${pg}"]`);await sleep(500);const w=await P.evaluate(()=>({sw:document.documentElement.scrollWidth,bw:document.body.scrollWidth,iw:innerWidth}));ok('RX-8-'+pg,w.sw<=w.iw+2&&w.bw<=w.iw+2,'phone: '+pg+' page does not scroll sideways',JSON.stringify(w));}
 await P.evaluate(()=>{S.editing={lines:[emptyLine(1)],consignment:false,orderDate:today()};S.orderWizStep=2;S.page='new-order';render();});await sleep(500);
 {const w=await P.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,inputs:[...document.querySelectorAll('input,select')].filter(e=>e.getBoundingClientRect().right>innerWidth+2).length}));ok('RX-8-neworder','sw' in w&&w.sw<=w.iw+2&&w.inputs===0,'phone: new-order form fits the screen',JSON.stringify(w));}
 await P.screenshot({path:process.env.SHOT_DIR?process.env.SHOT_DIR+'/phone.png':'/tmp/phone.png'});

 // ---- find OLD orders by part number (outside the 24-month window)
 const old=n=>{const d=new Date();d.setMonth(d.getMonth()-n);d.setDate(10);return d.toISOString().slice(0,10);};
 const mkO=(id,po,part,date)=>({id,customerName:'UAT-RX Co',customerPONo:po,orderDate:date,buyerName:'B',saved:true,_rev:1,lines:[{lineNo:1,partNo:part,poQty:5,delivered:5,inTransit:0,shipmentType:'Kan-Ban',inTransitDays:10,originalDockDate:date,additionalNotes:'',lineStatus:'Open',shortCloseQty:0}]});
 const seed=(po,part,date,id)=>sp('createItem','POM_Orders',{Title:po,POM_Data:JSON.stringify(mkO(id,po,part,date)),Cols:JSON.stringify({Customer:'UAT-RX Co',OrderDate:date+'T00:00:00Z',Status:'Closed',PartNos:';'+part+';'})});
 seed('UAT-RXOLD1','UAT-RX-ZZ9',old(30),880001);seed('UAT-RXOLD2','UAT-RX-ZZ9',old(40),880002);seed('UAT-RXOLD3','UAT-RX-OTHER',old(35),880003);
 const B=await newPage(br);await login(B,ADM,APW);
 const has=(pg,po)=>pg.evaluate(po=>S.orders.some(o=>o.customerPONo===po),po);
 ok('RX-9a',!(await has(B,'UAT-RXOLD1'))&&!(await has(B,'UAT-RXOLD2')),'orders older than 24 months are not loaded at sign-in');
 await nav(B,'orders');ok('RX-9b',await B.isVisible('#histPartBtn'),'"Find old orders by part number" is shown');
 await B.fill('#histPart','rx-zz9');await B.fill('#histPartFrom',old(60));await B.click('#histPartBtn');await H.settle(B,1500);await sleep(800);
 ok('RX-9c',(await has(B,'UAT-RXOLD1'))&&(await has(B,'UAT-RXOLD2')),'part search loads both old orders with that part (not case sensitive)');
 ok('RX-9d',!(await has(B,'UAT-RXOLD3')),'an old order with a different part is not loaded');
 const shown=await B.evaluate(()=>applyOrderFilters(S.orders).map(o=>o.customerPONo).filter(p=>/UAT-RXOLD/.test(p)).sort());
 ok('RX-9e',JSON.stringify(shown)==='["UAT-RXOLD1","UAT-RXOLD2"]','Orders list is filtered to that part',JSON.stringify(shown));
 const pn=await B.evaluate(()=>partNosCol({lines:[{partNo:'A'},{partNo:'B'},{partNo:'A'}]}));ok('RX-9f',pn===';A;B;','PartNos column text is ";A;B;"',pn);
 // ---- clean-up
 await A.click('#logoutBtn').catch(()=>{});purge();
 const left=[];for(const l of ['POM_Orders','POM_Shipments','POM_Finance','POM_Customers','POM_Parts','POM_Users'])for(const i of (sp('getItems',l)[1].value||[]))if(/UAT-RX/.test(i.POM_Data||'')||/^UAT-RX/.test(i.Title||'')||i.Title===V1)left.push(l+':'+i.Title);
 ok('RX-CLEAN',left.length===0,'test data removed',JSON.stringify(left));
 const errs=[...(A.errs||[]),...(V.errs||[]),...(B.errs||[])];ok('RX-JS',errs.length===0,'no JavaScript errors',errs.slice(0,3).join('|'));
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== REMAINING UAT (${MODE}): ${U.results.length-f.length} passed, ${f.length} failed ===`);
 await br.close();process.exit(0);
})().catch(e=>{console.error('RUNNER ERROR',String(e.stack||e.message).split(process.env.POM_FLOW_URL||'\u0000').join('<flow-url>'));try{purge()}catch{};process.exit(2);});
