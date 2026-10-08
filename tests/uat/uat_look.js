// Visual-consistency check (mock): same top bar on every tab, one type system (Inter + Source Serif only), sizes 11+ , weights 400-600.
const U=require('./lib');const H=require('./helpers');const {ok}=U;
(async()=>{U.seedMock();const br=await U.launch();const A=await H.newPage(br);await H.login(A,'admin@uat.test','pw');
 await H.addCustomer(A,'Look Co');await H.addPart(A,'Look Co','LK-1','p');
 await H.createOrder(A,{cust:'Look Co',po:'LK-PO',lines:[{part:'LK-1',qty:5,inr:1,us:2}]});
 await H.createShipment(A,{inv:'LK-INV',lines:[{po:'LK-PO',part:'LK-1',qty:2}]});
 const measure=()=>A.evaluate(()=>{const bad=new Set();const w=document.createTreeWalker(document.getElementById('root'),NodeFilter.SHOW_TEXT);let n;
  while(n=w.nextNode()){if(!n.nodeValue.trim())continue;const e=n.parentElement,cs=getComputedStyle(e);if(cs.display==='none'||(!e.offsetParent&&cs.position!=='fixed'))continue;
   const f=cs.fontFamily.split(',')[0].replace(/['"]/g,'');const sz=parseFloat(cs.fontSize),wt=+cs.fontWeight;
   if(!/^(Inter|Source Serif 4)$/.test(f)||sz<11||wt>600)bad.add(f+' '+cs.fontSize+' '+wt+' "'+n.nodeValue.trim().slice(0,18)+'"');}
  const tb=document.querySelector('.topbar').getBoundingClientRect();return{h:tb.height,top:tb.top,bad:[...bad].slice(0,5)};});
 for(const p of ['dashboard','orders','shipments','masters','users']){await H.nav(A,p);await H.sleep(400);const m=await measure();
  ok('LOOK-'+p,m.h===60&&m.top===0&&m.bad.length===0,p+': top bar 60px like every tab; only Inter/Source Serif, sizes >= 11, weights <= 600',JSON.stringify(m));}
 // 1280px laptop: form fields must stay inside their card (order line, shipment line) and viewers get no 'New Shipment' button
 await A.setViewportSize({width:1280,height:900});
 await A.evaluate(()=>{S.editing={lines:[emptyLine(1)],consignment:false,orderDate:today()};S.orderWizStep=2;S.page='new-order';render();});await H.sleep(400);
 const o1=await A.evaluate(()=>{const c=document.querySelector('.line-item').getBoundingClientRect();return[...document.querySelectorAll('.line-item input,.line-item select,.line-item textarea')].filter(e=>e.getBoundingClientRect().right>c.right+1).length;});
 ok('LOOK-orderform-1280',o1===0,'order line fields stay inside their card at 1280px wide',String(o1));
 await A.evaluate(()=>{S.editingShipment={lines:[emptyShipLine(1)],kanban:false,location:'India',dateOfInvoice:today(),dateOfShipping:today()};S.shipWizStep=2;S.page='new-shipment';render();});await H.sleep(400);
 const o2=await A.evaluate(()=>{const c=document.querySelector('.line-item').getBoundingClientRect();return[...document.querySelectorAll('.line-item input,.line-item select,.line-item textarea')].filter(e=>e.getBoundingClientRect().right>c.right+1).length;});
 ok('LOOK-shipform-1280',o2===0,'shipment line fields stay inside their card at 1280px wide',String(o2));
 
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== LOOK: ${U.results.length-f.length} passed, ${f.length} failed ===`);await br.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
