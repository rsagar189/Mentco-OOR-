const U=require('./lib');const APP=process.argv[2];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
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


module.exports={settle,newPage,login,signedIn,nav,put,confirmModal,addCustomer,addPart,createOrder,createShipment,ord,sleep};
