// Keyboard entry: Tab must move to the next field, keep what was typed, and keep the scroll position (no jump to the top)
const U=require('./lib');const H=require('./helpers');const {ok}=U;const sl=H.sleep;
(async()=>{U.seedMock();const br=await U.launch();const A=await H.newPage(br);await A.setViewportSize({width:1280,height:700});await H.login(A,'admin@uat.test','pw');
 await H.addCustomer(A,'Tab Co');await H.addPart(A,'Tab Co','TB-1','p');
 await H.nav(A,'orders');await A.click('#newOrderBtn');await sl(300);await A.selectOption('[data-f="customerName"]','Tab Co');await H.put(A,'[data-f="customerPONo"]','TAB-1');
 await A.click('#wizNextBtn');await sl(400);await A.selectOption('[data-f="lines.0.partNo"]','TB-1');await sl(300);
 const st=()=>A.evaluate(()=>({top:document.querySelector('.main').scrollTop,f:document.activeElement&&(document.activeElement.dataset.f||document.activeElement.id||document.activeElement.tagName)}));
 // scroll down so that "jump to top" would be visible, then type in PO Qty and press Tab
 await A.evaluate(()=>{document.querySelector('.main').scrollTop=0;});
 await A.click('[data-f="lines.0.poQty"]');await A.keyboard.press('Control+A');await A.keyboard.type('250');
 await A.evaluate(()=>{document.querySelector('.main').scrollTop=150;});
 const before=await st();await A.keyboard.press('Tab');await sl(500);const after=await st();
 const val=await A.inputValue('[data-f="lines.0.poQty"]');
 ok('TAB-1',val==='250','what you typed in PO Qty is kept after Tab',val);
 ok('TAB-2',after.top>=100,'the page does not jump to the top after Tab (scroll '+before.top+' -> '+after.top+')',JSON.stringify([before,after]));
 const idx=await A.evaluate(()=>{const L=[...document.querySelectorAll('input,select,textarea,button,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.type!=='hidden'&&e.offsetParent!==null);const p=document.querySelector('[data-f="lines.0.poQty"]');return{poQty:L.indexOf(p),active:L.indexOf(document.activeElement)};});
 ok('TAB-3',idx.active===idx.poQty+1,'focus lands on the very next field after PO Qty',JSON.stringify(idx));
 // type straight into the next field(s): rates, then Tab again
 await A.keyboard.type('10');await A.keyboard.press('Tab');await sl(400);const s2=await st();
 ok('TAB-4',s2.top>=100&&s2.f&&s2.f!=='BODY','a second Tab keeps going down the form',JSON.stringify(s2));
 // search box: typing must not lose focus after the pause
 await A.evaluate(()=>{S.page='orders';S.editing=null;render();});await sl(300);
 await A.click('#searchInput');await A.keyboard.type('ta');await sl(700);await A.keyboard.type('b');await sl(700);
 const sv=await A.inputValue('#searchInput');ok('TAB-5',sv==='tab','typing in the search box keeps working after the screen refreshes (typed "tab")',sv);
 // Shift+Tab goes back one field
 await A.evaluate(()=>{S.editing={lines:[emptyLine(1)],consignment:false,orderDate:today()};S.orderWizStep=2;S.page='new-order';render();});await sl(400);
 await A.click('[data-f="lines.0.inTransitDays"]');await A.keyboard.press('Control+A');await A.keyboard.type('12');await A.keyboard.press('Shift+Tab');await sl(500);
 const sb=await A.evaluate(()=>{const L=[...document.querySelectorAll('input,select,textarea,button,a[href],[tabindex]')].filter(e=>!e.disabled&&e.tabIndex>=0&&e.type!=='hidden'&&e.offsetParent!==null);const p=document.querySelector('[data-f="lines.0.inTransitDays"]');return{me:L.indexOf(p),active:L.indexOf(document.activeElement),val:p.value};});
 ok('TAB-6',sb.active===sb.me-1&&sb.val==='12','Shift+Tab goes back one field and keeps the value',JSON.stringify(sb));
 // Clicking another field right after typing lands in that field
 await A.click('[data-f="lines.0.poQty"]');await A.keyboard.press('Control+A');await A.keyboard.type('77');await A.click('[data-f="lines.0.indiaRate"]');await A.keyboard.type('9');await sl(500);
 const ck=await A.evaluate(()=>({af:document.activeElement.dataset.f,po:document.querySelector('[data-f="lines.0.poQty"]').value,ir:document.querySelector('[data-f="lines.0.indiaRate"]').value}));
 ok('TAB-7',ck.af==='lines.0.indiaRate'&&ck.po==='77'&&/9/.test(ck.ir),'clicking another field after typing: you land there, and both values are kept',JSON.stringify(ck));
 // A dropdown changed with the keyboard keeps the cursor on it
 await A.evaluate(()=>{S.editing={lines:[emptyLine(1)],consignment:false,orderDate:today()};S.orderWizStep=1;S.page='new-order';render();});await sl(400);
 await H.nav(A,'masters');await A.click('[data-master-tab="customers"]');await A.fill('#newCustName','Tab Co 2');await A.click('#addCustBtn');await H.settle(A);
 await A.evaluate(()=>{S.editing={lines:[emptyLine(1)],consignment:false,orderDate:today()};S.orderWizStep=1;S.page='new-order';render();});await sl(400);
 await A.focus('[data-f="customerName"]');await A.keyboard.press('ArrowDown');await sl(500);
 const sel=await A.evaluate(()=>({af:document.activeElement.dataset&&document.activeElement.dataset.f,v:document.querySelector('[data-f="customerName"]').value}));
 ok('TAB-8',sel.af==='customerName'&&!!sel.v,'changing the customer with the keyboard keeps the cursor on that dropdown',JSON.stringify(sel));
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== TAB/KEYBOARD: ${U.results.length-f.length} passed, ${f.length} failed ===`);await br.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.message);process.exit(2);});
