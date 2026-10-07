const U=require('./lib');const {ok,MODE}=U;
const APP=process.argv[2];
const ADM_EMAIL=MODE==='real'?process.env.POM_UAT_ADMIN_EMAIL:'admin@uat.test';
const ADM_PW=MODE==='real'?process.env.POM_UAT_ADMIN_PASSWORD:'pw';
const rnd=()=>require('crypto').randomBytes(9).toString('base64').replace(/[^A-Za-z0-9]/g,'x')+'!9';
const PW={staff:rnd(),v1:rnd(),v2:rnd(),staff2:rnd()};
const EM={staff:'uat-staff@example.com',v1:'uat-viewer1@example.com',v2:'uat-viewer2@example.com'};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// ---------- direct gateway access (as admin) for verifying what is really stored
let adminTok=null;
async function sp(action,list,payload={}){
  if(!adminTok){const r=U.gateway({action:'login',listName:'',token:'',email:ADM_EMAIL.toLowerCase(),passHash:U.HASH(ADM_EMAIL,ADM_PW)});if(r[0]!==200)throw new Error('admin login failed '+r[0]);adminTok=r[1].token;}
  const r=U.gateway({action,listName:list,token:adminTok,...payload});return r;
}
const rows=async l=>{const r=await sp('getItems',l);if(r[0]!==200)throw new Error(l+' '+r[0]);return (r[1].value||r[1]||[]).map(i=>({id:i.ID??i.Id,title:i.Title,data:(()=>{try{return JSON.parse(i.POM_Data)}catch{return null}})(),raw:i.POM_Data}));};
// ---------- browser helpers
async function settle(pg,ms=600){let quiet=0,n=0;while(quiet<ms&&n<400){const f=await pg.evaluate(()=>window.__inflight||0).catch(()=>0);if(f===0)quiet+=100;else quiet=0;await sleep(100);n++;}}
async function newPage(br){const pg=await U.openApp(br,APP);await pg.addInitScript(()=>{window.__inflight=0;const f=window.fetch;window.fetch=function(){window.__inflight++;return f.apply(this,arguments).finally(()=>{window.__inflight--;});};});await pg.reload();return pg;}
async function login(pg,e,p){await pg.fill('#lemail',e);await pg.fill('#lpass',p);await pg.click('#lbtn');await settle(pg,800);await sleep(300);}
const signedIn=pg=>pg.evaluate(()=>!!S.user&&S.page!=='login');
const put=async(pg,sel,val)=>{await pg.fill(sel,String(val));await pg.press(sel,'Tab').catch(()=>{});await sleep(160);};
const nav=async(pg,p)=>{await pg.click(`[data-nav="${p}"]`);await sleep(250);};
async function confirmModal(pg){await pg.click('#modalConfirm');await settle(pg,800);}
async function addCustomer(pg,name){await nav(pg,'masters');await pg.click('[data-master-tab="customers"]');await pg.fill('#newCustName',name);await pg.click('#addCustBtn');await settle(pg);}
async function addPart(pg,cust,part,desc){await nav(pg,'masters');await pg.click('[data-master-tab="parts"]');await pg.selectOption('#newPartCust',{label:cust});await pg.fill('#newPartNo',part);await pg.fill('#newPartDesc',desc||'');await pg.click('#addPartBtn');await settle(pg);}
async function createOrder(pg,o){
  await nav(pg,'orders');await pg.click('#newOrderBtn');await sleep(250);
  await pg.selectOption('[data-f="customerName"]',{label:o.cust});await sleep(200);
  await put(pg,'[data-f="customerPONo"]',o.po);await put(pg,'[data-f="buyerName"]',o.buyer||'UAT Buyer');
  await pg.click('#wizNextBtn');await sleep(250);
  for(let i=0;i<o.lines.length;i++){
    if(i>0){await pg.click('#addLineBtn');await sleep(250);}
    const l=o.lines[i];
    await pg.selectOption(`[data-f="lines.${i}.partNo"]`,{label:new RegExp('^'+l.part)}).catch(async()=>{await pg.selectOption(`[data-f="lines.${i}.partNo"]`,l.part);});
    await put(pg,`[data-f="lines.${i}.poQty"]`,String(l.qty));
    await put(pg,`[data-f="lines.${i}.inTransitDays"]`,String(l.days??10));
    await put(pg,`[data-f="lines.${i}.originalDockDate"]`,l.dock||'2030-01-15');
    await put(pg,`[data-f="lines.${i}.indiaRate"]`,String(l.inr));await put(pg,`[data-f="lines.${i}.usRate"]`,String(l.us));
    if(l.notes)await put(pg,`[data-f="lines.${i}.additionalNotes"]`,l.notes);
  }
  await pg.click('#wizNextBtn');await sleep(250);
  await pg.click('#saveOrderBtn');await sleep(250);await confirmModal(pg);await sleep(300);
}
async function createShipment(pg,s){
  await nav(pg,'shipments');await pg.click('#newShipmentBtn');await sleep(250);
  await put(pg,'[data-sf="shippingInvoiceNo"]',s.inv);await put(pg,'[data-sf="dateOfShipping"]',s.ship||'2029-12-01');
  await pg.click('#shipWizNextBtn');await sleep(250);
  for(let i=0;i<s.lines.length;i++){
    if(i>0){await pg.click('#addShipLineBtn');await sleep(250);}
    const l=s.lines[i];
    await pg.selectOption(`[data-sf="slines.${i}.customerPONo"]`,l.po);await sleep(150);
    await pg.selectOption(`[data-sf="slines.${i}.partNo"]`,l.part);await sleep(250);
    await put(pg,`[data-sf="slines.${i}.shippedQty"]`,String(l.qty));
    await pg.selectOption(`[data-sf="slines.${i}.deliveryStatus"]`,l.status||'In Transit');
    if(l.status==='Delivered')await put(pg,`[data-sf="slines.${i}.deliveryDate"]`,l.ddate||'2029-12-20');
    const opts=await pg.$$eval(`[data-sf="slines.${i}.shippedTo"] option`,o=>o.map(x=>x.value));if(opts.length)await pg.selectOption(`[data-sf="slines.${i}.shippedTo"]`,opts[0]).catch(()=>{});
  }
  await pg.click('#shipWizNextBtn');await sleep(250);
  await pg.click('#saveShipBtn');await sleep(250);await confirmModal(pg);await sleep(300);
}
const ord=(pg,po)=>pg.evaluate(po=>{const o=S.orders.find(x=>x.customerPONo===po);return o?JSON.parse(JSON.stringify(o)):null;},po);

(async()=>{
 if(MODE==='mock')U.seedMock();
 const br=await U.launch();const t0=Date.now();
 // ---------- pre-clean any leftovers from an earlier run (only UAT- prefixed things)
 async function purge(){
  const del=async(l,pred)=>{for(const r of await rows(l)){if(pred(r)){const x=await sp('deleteItem',l,{itemId:r.id});}}};
  for(const l of ['POM_Orders','POM_Shipments','POM_Customers','POM_Parts','POM_Finance']) await del(l,r=>/UAT-/.test(r.raw||'')||/UAT-/.test(r.title||''));
  await del('POM_Users',r=>/^uat-/.test(r.title||'')&&r.title!==ADM_EMAIL.toLowerCase());
 }
 await purge();
 // =============== AUTH
 let A=await newPage(br);
 ok('AUTH-0',await A.isVisible('#lbtn')&&!(await A.innerText('body')).includes('Local preview'),'login screen shown, SharePoint mode on (no demo box)');
 await login(A,ADM_EMAIL,'wrong-password-123');
 ok('AUTH-1',!(await signedIn(A))&&await A.isVisible('#lerr'),'wrong password rejected', await A.innerText('#lerr').catch(()=>''));
 await login(A,'nobody-uat@example.com','whatever123');
 ok('AUTH-2',!(await signedIn(A)),'unknown email rejected');
 await login(A,ADM_EMAIL,ADM_PW);
 ok('AUTH-3',await signedIn(A)&&await A.evaluate(()=>S.user.role)==='Admin','admin signs in, role Admin');
 ok('AUTH-3b',(await A.innerText('body')).includes('SharePoint'),'green SharePoint badge visible');
 await A.reload();await settle(A,1200);await sleep(500);
 ok('AUTH-4',await signedIn(A),'refresh keeps you signed in');
 // =============== MASTER DATA
 await addCustomer(A,'UAT-Customer A');await addCustomer(A,"UAT-O'Brien & Sons <b>");
 let cr=await rows('POM_Customers');
 ok('MST-1',cr.filter(r=>/UAT-/.test(r.title)).length===2,'2 customers saved to SharePoint',JSON.stringify(cr.map(r=>r.title)));
 ok('DAT-7a',cr.some(r=>r.data?.name==="UAT-O'Brien & Sons <b>"),'special characters (apostrophe, &, <b>) stored exactly');
 await addCustomer(A,'UAT-Customer A');
 cr=await rows('POM_Customers');
 ok('MST-2',cr.filter(r=>r.title==='UAT-Customer A').length===1,'duplicate customer blocked (still 1 row)');
 await addPart(A,'UAT-Customer A','UAT-P100','test part one');await addPart(A,'UAT-Customer A','UAT-P200','test part two');
 let pr=await rows('POM_Parts');
 ok('MST-3',pr.filter(r=>/UAT-P/.test(r.title)).length===2,'2 parts saved');
 await addPart(A,'UAT-Customer A','UAT-P100','dup');pr=await rows('POM_Parts');
 ok('MST-4',pr.filter(r=>r.title==='UAT-P100').length===1,'duplicate part blocked');
 // edit customer
 await nav(A,'masters');await A.click('[data-master-tab="customers"]');
 const cid=await A.evaluate(()=>S.customers.find(c=>c.name==='UAT-Customer A').id);
 await A.click(`[data-action="editCust"][data-id="${cid}"]`);await sleep(200);
 await A.fill(`#ecc${cid}`,'Contact Person');await A.click(`[data-action="saveCust"][data-id="${cid}"]`);await settle(A);
 cr=await rows('POM_Customers');const ca=cr.filter(r=>r.title==='UAT-Customer A');
 ok('MST-5',ca.length===1&&ca[0].data.contact==='Contact Person','editing a customer updates the same row (no duplicate)',JSON.stringify(ca.map(r=>r.data)));
 // =============== USERS
 await nav(A,'users');
 const addUser=async(name,email,pw,role)=>{await A.fill('#uName',name);await A.fill('#uEmail',email);await A.fill('#uPassword',pw);await A.selectOption('#uRole',role);await A.click('#saveUserBtn');await settle(A,800);await sleep(300);};
 await addUser('UAT Staff',EM.staff,PW.staff,'Staff');await addUser('UAT Viewer1',EM.v1,PW.v1,'Viewer1');await addUser('UAT Viewer2',EM.v2,PW.v2,'Viewer2');
 let ur=await rows('POM_Users');
 ok('USR-1',['staff','v1','v2'].every(k=>ur.some(r=>r.title===EM[k])),'3 users created (any email works) and saved to SharePoint');
 ok('USR-1b',ur.filter(r=>/^uat-/.test(r.title)).every(r=>r.data.passHash&&r.data.passHash.length===64&&!r.data.password&&!r.raw.includes(PW.staff)),'passwords stored only as hash');
 await addUser('Dup',EM.staff,'x1y2z3!!','Staff');ur=await rows('POM_Users');
 ok('USR-3',ur.filter(r=>r.title===EM.staff).length===1,'duplicate email blocked');
 await A.fill('#uName','No Pw');await A.fill('#uEmail','uat-nopw@example.com');await A.fill('#uPassword','');await A.click('#saveUserBtn');await settle(A);
 ur=await rows('POM_Users');ok('USR-4',!ur.some(r=>r.title==='uat-nopw@example.com'),'user without password blocked');
 // =============== ORDERS (as Admin, through the real screens)
 await createOrder(A,{cust:'UAT-Customer A',po:'UAT-PO-001',lines:[{part:'UAT-P100',qty:100,us:8,inr:5},{part:'UAT-P200',qty:50,us:20,inr:12.5,notes:'Line note: "quoted" & café — 日本語'}]});
 let o1=await ord(A,'UAT-PO-001');
 ok('ORD-4',!!o1&&o1.lines.length===2,'order created through the 3-step screen with 2 lines',JSON.stringify(o1&&o1.lines.length));
 const or=await rows('POM_Orders');const orow=or.find(r=>r.title==='UAT-PO-001');
 ok('ORD-5',orow&&orow.data.lines.every(l=>l.usRate===undefined&&l.indiaRate===undefined),'order row in SharePoint has NO rates');
 const fr=await rows('POM_Finance');const frow=fr.find(r=>r.data&&r.data.id===(o1&&o1.id));
 ok('ORD-6',frow&&frow.data.rates[0].us===8&&frow.data.rates[0].in===5&&frow.data.rates[1].us===20&&frow.data.rates[1].in===12.5,'rates stored in POM_Finance',JSON.stringify(frow&&frow.data));
 await A.reload();await settle(A,1200);await sleep(600);
 o1=await ord(A,'UAT-PO-001');
 ok('ORD-7',o1&&o1.lines[0].usRate===8&&o1.lines[1].indiaRate===12.5,'after refresh the order and its rates are back');
 ok('DAT-7b',o1&&o1.lines[1].additionalNotes==='Line note: "quoted" & café — 日本語','quotes, &, accents and Japanese text survive save/reload');
 // dashboard
 await nav(A,'dashboard');await sleep(400);const dash=await A.innerText('body');
 const expUS=100*8+50*20, expIN=100*5+50*12.5;
 const nums=[...dash.matchAll(/\$\s?([\d,]+(?:\.\d+)?)\s?([KkMm]?)/g)].map(m=>parseFloat(m[1].replace(/,/g,''))*({K:1e3,M:1e6}[m[2].toUpperCase()]||1));
 const near=(a,b)=>Math.abs(a-b)<=Math.max(60,b*0.06);
 ok('DSH-1',nums.some(n=>near(n,expUS))&&nums.some(n=>near(n,expIN)),`dashboard PO values match hand calculation (US ${expUS}, India ${expIN})`,'seen '+JSON.stringify(nums.slice(0,8)));
 // edit order qty
 await nav(A,'orders');await A.click(`[data-action="edit"][data-id="${o1.id}"]`);await sleep(300);
 await A.click('#wizNextBtn');await sleep(250);await put(A,'[data-f="lines.0.poQty"]','120');await A.click('#wizNextBtn');await sleep(250);await A.click('#saveOrderBtn');await sleep(250);await confirmModal(A);await sleep(300);
 const or2=(await rows('POM_Orders')).filter(r=>r.title==='UAT-PO-001');
 ok('ORD-9',or2.length===1&&or2[0].data.lines[0].poQty===120,'editing an order updates the same SharePoint row',`rows=${or2.length}`);
 // short close + cancel line + reopen + cancel PO via app functions (same code the buttons call)
 await A.evaluate(id=>{const o=S.orders.find(x=>x.id===id);o.lines[0].lineStatus='Short Closed';o.lines[0].shortCloseQty=20;auditLog('order',o.id,o.customerPONo,'Short Closed',[{field:'Line 1 Line Status',from:'Open',to:'Short Closed'}]);return spSaveOrder(o);},o1.id);await settle(A);
 let c1=await A.evaluate(id=>calcLine(S.orders.find(x=>x.id===id).lines[0]),o1.id);
 ok('ORD-10',c1.effectiveQty===100&&c1.poStatus==='Open','short close: effective qty = 120-20 = 100',JSON.stringify(c1));
 await A.evaluate(id=>{const o=S.orders.find(x=>x.id===id);o.lines[1].lineStatus='Cancelled';return spSaveOrder(o);},o1.id);await settle(A);
 c1=await A.evaluate(id=>calcLine(S.orders.find(x=>x.id===id).lines[1]),o1.id);
 ok('ORD-11',c1.effectiveQty===0&&c1.isCancelled,'cancelled line counts as 0');
 await A.evaluate(id=>{const o=S.orders.find(x=>x.id===id);o.lines[1].lineStatus='Open';return spSaveOrder(o);},o1.id);await settle(A);
 // =============== SHIPMENTS
 await createShipment(A,{inv:'UAT-INV-001',lines:[{po:'UAT-PO-001',part:'UAT-P100',qty:40,status:'In Transit'}]});
 let sr=(await rows('POM_Shipments')).filter(r=>r.title==='UAT-INV-001');
 ok('SHP-3',sr.length===1,'shipment saved (1 row)',`rows=${sr.length}`);
 o1=await ord(A,'UAT-PO-001');
 ok('SHP-4',o1.lines[0].inTransit===40,'order line shows 40 in transit',JSON.stringify(o1.lines[0].inTransit));
 await A.evaluate(()=>{const s=S.shipments.find(x=>x.shippingInvoiceNo==='UAT-INV-001');s.lines[0].deliveryStatus='Delivered';s.lines[0].deliveryDate='2029-12-20';syncShipmentsToOrders();return spSaveShipment(s);});await settle(A);
 o1=await ord(A,'UAT-PO-001');
 ok('SHP-5',o1.lines[0].delivered===40&&o1.lines[0].inTransit===0,'delivered: 40 delivered, 0 in transit',JSON.stringify([o1.lines[0].delivered,o1.lines[0].inTransit]));
 await A.reload();await settle(A,1200);await sleep(600);o1=await ord(A,'UAT-PO-001');
 ok('SHP-5b',o1.lines[0].delivered===40,'delivered quantity still right after refresh (recalculated from shipments)');
 await A.evaluate(()=>{const s=S.shipments.find(x=>x.shippingInvoiceNo==='UAT-INV-001');const sp=s._spId;S.shipments=S.shipments.filter(x=>x!==s);syncShipmentsToOrders();return spDeleteShipment(sp);});await settle(A);
 o1=await ord(A,'UAT-PO-001');sr=(await rows('POM_Shipments')).filter(r=>r.title==='UAT-INV-001');
 ok('SHP-8',o1.lines[0].delivered===0&&sr.length===0,'deleting a shipment removes the row and returns the quantities');
 // =============== AUDIT
 const au=await rows('POM_AuditLog');
 ok('AUD-1',au.length>0,`audit entries are written to SharePoint (${au.length})`);
 // =============== ROLES
 const roleChecks={};
 for(const [k,role] of [['staff','Staff'],['v1','Viewer1'],['v2','Viewer2']]){
  const P=await newPage(br);await login(P,EM[k],PW[k]);
  const okIn=await signedIn(P)&&await P.evaluate(()=>S.user.role)===role;ok('ROL-0'+k,okIn,`${role} signs in with a non-company email`);
  if(!okIn)continue;
  const has=sel=>P.$(sel).then(x=>!!x);
  await nav(P,'orders');
  const newBtn=await has('#newOrderBtn');
  const editBtn=await P.$$eval('[data-action="edit"]',e=>e.length);const delBtn=await P.$$eval('[data-action="deleteOrder"]',e=>e.length);
  const masters=await has('[data-nav="masters"]'),users=await has('[data-nav="users"]');
  const o=await ord(P,'UAT-PO-001');const rate=o?o.lines[0].usRate:null;
  const exp={staff:{newBtn:true,del:0,masters:false,users:false,rate:8,edit:1},v1:{newBtn:false,del:0,masters:false,users:false,rate:0,edit:0},v2:{newBtn:false,del:0,masters:false,users:false,rate:8,edit:0}}[k];
  ok('ROL-1'+k,!!o,`${role} can see orders`);
  ok('ROL-2'+k,rate===exp.rate,`${role} sees rates = ${exp.rate}`,String(rate));
  ok('ROL-4'+k,newBtn===exp.newBtn,`${role} "+ New Order" button ${exp.newBtn?'present':'hidden'}`);
  ok('ROL-5'+k,(editBtn>0)===(exp.edit>0),`${role} edit button ${exp.edit?'present':'hidden'}`);
  ok('ROL-6'+k,delBtn===0,`${role} has no Delete button`);
  ok('ROL-7'+k,masters===exp.masters&&users===exp.users,`${role}: Master Data menu ${exp.masters?'yes':'hidden'}, Users menu ${exp.users?'yes':'hidden'}`);
  const body=await P.innerText('body');
  if(k==='v1'){await nav(P,'dashboard');await sleep(300);const d=await P.innerText('body');ok('ROL-3v1',!/PO VALUE US/i.test(d),'Viewer1 dashboard has no finance cards');}
  if(k!=='v1'){await nav(P,'dashboard');await sleep(300);const d=await P.innerText('body');ok('ROL-3'+k,/PO VALUE US/i.test(d),`${role} dashboard shows finance cards`);}
  // server-side
  const tryCall=(a,l,p)=>P.evaluate(async([a,l,p])=>{try{const r=await flowCall(a,l,p);return'ALLOWED';}catch(e){return e.message;}},[a,l,p||{}]);
  const oid=(await rows('POM_Orders')).find(r=>r.title==='UAT-PO-001').id;
  const dres=await tryCall('deleteItem','POM_Orders',{itemId:oid});
  ok('SEC-1'+k,/Not allowed/.test(dres)&&(await rows('POM_Orders')).some(r=>r.id===oid),`${role}: direct delete of an order is blocked by the server`,dres);
  const ures=await tryCall('getItems','POM_Users');ok('SEC-4'+k,/Not allowed/.test(ures),`${role}: cannot read the users list`,ures);
  const sres=await tryCall('getItems','POM_Sessions');ok('SEC-5'+k,/Not allowed/.test(sres),`${role}: cannot read the sessions list`,sres);
  const cres=await tryCall('createItem','POM_Customers',{Title:'UAT-hack',POM_Data:'{}'});ok('SEC-6'+k,/Not allowed/.test(cres),`${role}: cannot create master data`,cres);
  const fres=await tryCall('getItems','POM_Finance');
  if(k==='v1')ok('SEC-2v1',/Not allowed/.test(fres),'Viewer1: cannot read finance data from the server',fres);
  else ok('SEC-2'+k,fres==='ALLOWED',`${role}: can read finance data`,fres);
  if(k==='staff'){const w=await tryCall('createItem','POM_Orders',{Title:'UAT-staff-order',POM_Data:JSON.stringify({id:9999,customerPONo:'UAT-staff-order',lines:[]})});ok('SEC-7staff','ALLOWED'===w,'Staff: can create an order record',w);}
  if(k!=='staff'){const w=await tryCall('createItem','POM_Orders',{Title:'UAT-hack',POM_Data:'{}'});ok('SEC-7'+k,/Not allowed/.test(w),`${role}: cannot create an order record`,w);}
  await P.click('#logoutBtn');await settle(P);
 }
 // no token / bad token
 const noTok=U.gateway({action:'getItems',listName:'POM_Orders',token:''});
 ok('SEC-3',noTok[0]===401,'request with no token is rejected (401)',String(noTok[0]));
 const badTok=U.gateway({action:'getItems',listName:'POM_Orders',token:"x' or 1 eq 1 or Title eq '"});
 ok('SEC-3b',badTok[0]===401,"request with a forged / injection-style token is rejected (401)",String(badTok[0]));
 const adminSess=await sp('getItems','POM_Sessions');ok('SEC-5a',adminSess[0]===403,'even Admin cannot read the sessions list through the app gateway',String(adminSess[0]));
 // =============== USER MANAGEMENT edits
 await nav(A,'users');
 const sid=await A.evaluate(e=>USERS.find(u=>u.email===e).id,EM.staff);
 await A.evaluate(id=>{S.userEdit=id;render();},sid);await sleep(200);
 await A.selectOption('#uRole','Viewer1');await A.click('#saveUserBtn');await settle(A,800);
 ur=await rows('POM_Users');ok('USR-5',JSON.parse(ur.find(r=>r.title===EM.staff).raw).role==='Viewer1','role change saved to SharePoint');
 await A.evaluate(id=>{S.userEdit=id;render();},sid);await sleep(200);
 await A.fill('#uPassword',PW.staff2);await A.click('#saveUserBtn');await settle(A,800);
 let T=await newPage(br);await login(T,EM.staff,PW.staff);const oldOk=await signedIn(T);
 await login(T,EM.staff,PW.staff2);const newOk=await signedIn(T);
 ok('USR-6',!oldOk&&newOk,'after a password change the old password fails and the new one works');
 ok('USR-5b',newOk&&await T.evaluate(()=>S.user.role)==='Viewer1','the changed role applies at next sign-in');
 await T.click('#logoutBtn');await settle(T);
 await A.evaluate(id=>{S.userEdit=id;render();},sid);await sleep(200);
 await A.fill('#uEmail','uat-staff-renamed@example.com');await A.click('#saveUserBtn');await sleep(300);
 ok('USR-7',(await A.innerText('#userFormErr').catch(()=>'')).toLowerCase().includes('password'),'changing an email without a new password is refused');
 await A.evaluate(()=>{S.userEdit=null;render();});
 ok('USR-9',!(await A.$(`[data-action="deleteUser"][data-id="${await A.evaluate(()=>S.user.id)}"]`)),'you cannot delete yourself');
 // =============== TWO PEOPLE AT ONCE
 await createOrder(A,{cust:'UAT-Customer A',po:'UAT-PO-002',lines:[{part:'UAT-P100',qty:10,us:1,inr:1}]});
 const B2=await newPage(br);await login(B2,ADM_EMAIL,ADM_PW);
 await Promise.all([
  A.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='UAT-PO-001');o.lines[0].additionalNotes='edited by A';return spSaveOrder(o);}),
  B2.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='UAT-PO-002');o.lines[0].additionalNotes='edited by B';return spSaveOrder(o);})]);
 await settle(A);await settle(B2);
 const rr=await rows('POM_Orders');
 ok('DAT-2',rr.find(r=>r.title==='UAT-PO-001').data.lines[0].additionalNotes==='edited by A'&&rr.find(r=>r.title==='UAT-PO-002').data.lines[0].additionalNotes==='edited by B','two people editing different orders at once: both saved');
 // long text
 const long='L'.repeat(2500);
 await A.evaluate(l=>{const o=S.orders.find(x=>x.customerPONo==='UAT-PO-002');o.lines[0].additionalNotes=l;return spSaveOrder(o);},long);await settle(A);
 const rl=(await rows('POM_Orders')).find(r=>r.title==='UAT-PO-002');
 ok('DAT-5',rl.data.lines[0].additionalNotes.length===2500,'a 2,500-character note saves in full');
 // export CSV
 await nav(A,'orders');await A.click('#orderExportBtn');await sleep(300);
 const [dl]=await Promise.all([A.waitForEvent('download',{timeout:8000}).catch(()=>null),A.click('#oexpConfirm').catch(()=>{})]);
 ok('ORD-16',!!dl,'order export downloads a CSV file',dl?dl.suggestedFilename():'no download');
 if(dl){const p=await dl.path();const txt=require('fs').readFileSync(p,'utf8');ok('ORD-16b',/UAT-PO-001/.test(txt),'CSV contains the test order');}
 // =============== LOGOUT + persistence of session
 await A.click('#logoutBtn');await settle(A);await A.reload();await sleep(800);
 ok('AUTH-5',await A.isVisible('#lbtn'),'after sign-out a refresh shows the login screen');
 ok('AUTH-5b',(await A.evaluate(()=>sessionStorage.getItem('pom_sess')))===null,'no saved sign-in left in the browser after sign-out');
 // =============== CLEAN UP
 await purge();
 const left=[];for(const l of ['POM_Orders','POM_Shipments','POM_Customers','POM_Parts','POM_Finance'])for(const r of await rows(l))if(/UAT-/.test(r.raw||'')||/UAT-/.test(r.title||''))left.push(l+':'+r.title);
 const uLeft=(await rows('POM_Users')).filter(r=>/^uat-/.test(r.title)&&r.title!==ADM_EMAIL.toLowerCase());
 ok('CLEAN',left.length===0&&uLeft.length===0,'all UAT test data and test users removed',JSON.stringify(left.concat(uLeft.map(r=>r.title))));
 const errs=[];for(const p of [A,B2,T])errs.push(...(p.errs||[]));
 ok('JS',errs.length===0,'no JavaScript errors in the browser',errs.slice(0,3).join(' | '));
 const f=U.results.filter(r=>!r.pass);
 console.log(`\n=== ${U.results.length-f.length} passed, ${f.length} failed (${Math.round((Date.now()-t0)/1000)}s, ${U.calls.length} flow calls, mode ${MODE}) ===`);
 require('fs').writeFileSync(__dirname+'/results.json',JSON.stringify(U.results.map(r=>({id:r.id,pass:r.pass,msg:r.msg,extra:r.pass?undefined:r.extra})),null,1));
 await br.close();process.exit(0);
})().catch(e=>{console.error('RUNNER ERROR',String(e.message).split(process.env.POM_FLOW_URL||'\u0000').join('<flow-url>'));process.exit(2);});
