// Customer and part numbers must come from Master Data (dropdowns only + save-time check)
const U=require('./lib');const H=require('./helpers');const {ok}=U;const sl=H.sleep;
(async()=>{U.seedMock();const br=await U.launch();const A=await H.newPage(br);await A.setViewportSize({width:1440,height:900});await H.login(A,'admin@uat.test','pw');
 await H.addCustomer(A,'Empty Co');await H.addCustomer(A,'Full Co');await H.addPart(A,'Full Co','FC-1','one');
 await H.nav(A,'orders');await A.click('#newOrderBtn');await sl(300);
 await A.selectOption('[data-f="customerName"]','Empty Co');await H.put(A,'[data-f="customerPONo"]','M-1');await A.click('#wizNextBtn');await sl(400);
 const t=await A.evaluate(()=>{const e=document.querySelector('[data-f="lines.0.partNo"]');return{tag:e.tagName,dis:e.disabled,txt:e.textContent}});
 ok('MD-1',t.tag==='SELECT'&&t.dis&&/Master Data/.test(t.txt),'a customer with no parts has NO typing box - Part No is a locked dropdown saying to add parts first',JSON.stringify(t));
 // forge a value the way a paste/script could, then try to save
 await A.evaluate(()=>{S.editing.lines[0].partNo='gdhth1';S.editing.lines[0].poQty=5;S.orderWizStep=3;render();});await sl(400);
 await A.click('#saveOrderBtn');await sl(400);
 const m=await A.evaluate(()=>({modal:!!S.modal,msg:document.body.textContent}));
 ok('MD-2',!m.modal&&/part 'gdhth1' is not in Master Data/.test(m.msg),'saving an order with a part that is not in Master Data is refused with a clear message',String(m.modal));
 ok('MD-3',(await A.evaluate(()=>S.orders.some(o=>o.customerPONo==='M-1')))===false,'the order was not saved');
 // forged customer
 await A.evaluate(()=>{S.editing.customerName='Nobody Ltd';S.editing.lines[0].partNo='FC-1';render();});await sl(300);
 await A.click('#saveOrderBtn');await sl(400);
 ok('MD-4',/customer 'Nobody Ltd' is not in Master Data/i.test(await A.evaluate(()=>document.body.textContent)),'saving with a customer that is not in Master Data is refused');
 // good order works
 await H.createOrder(A,{cust:'Full Co',po:'M-2',lines:[{part:'FC-1',qty:10,inr:1,us:2}]});
 ok('MD-5',await A.evaluate(()=>S.orders.some(o=>o.customerPONo==='M-2')),'a normal order with a Master Data customer and part saves fine');
 // old record with unknown part still opens and can be edited
 await A.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='M-2');o.lines[0].partNo='OLD-PART';});
 await A.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='M-2');S.editing=JSON.parse(JSON.stringify(o));S.page='edit-order';S.orderWizStep=3;render();});await sl(400);
 await A.click('#saveOrderBtn');await sl(400);
 ok('MD-6',await A.evaluate(()=>!!S.modal),'an older order that already has an unknown part is not blocked when saved unchanged');
 await A.evaluate(()=>{S.modal=null;S.page='orders';S.editing=null;render();});
 // shipment part: always a dropdown
 await A.evaluate(()=>{S.editingShipment={lines:[{lineNo:1,customerPONo:'NO-SUCH-PO',partNo:'',shippedQty:1,shippedTo:'Full Co',deliveryStatus:'In Transit'}],kanban:false,location:'India',dateOfInvoice:today(),dateOfShipping:today(),shippingInvoiceNo:'MD-S1'};S.shipWizStep=2;S.page='new-shipment';render();});await sl(400);
 const sp=await A.evaluate(()=>{const e=document.querySelector('[data-sf="slines.0.partNo"]');return e?e.tagName:'none';});
 ok('MD-7',sp==='SELECT','shipment Part No is always a dropdown (never a typing box)',sp);
 await A.evaluate(()=>{S.editingShipment.lines[0].partNo='junk-99';S.shipWizStep=3;render();});await sl(400);
 await A.click('#saveShipBtn');await sl(400);
 ok('MD-8',/part 'junk-99' is not in Master Data/.test(await A.evaluate(()=>document.body.textContent))&&!(await A.evaluate(()=>S.shipments.some(s=>s.shippingInvoiceNo==='MD-S1'))),'saving a shipment with a part that is not in Master Data is refused');
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== MASTER DATA ONLY: ${U.results.length-f.length} passed, ${f.length} failed ===`);await br.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
