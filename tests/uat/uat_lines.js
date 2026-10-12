// Order lines (one summary row per line, the open line shows every field), exact totals, alphabetical lists
const U=require('./lib');const H=require('./helpers');const {ok}=U;const sl=H.sleep;
(async()=>{U.seedMock();const br=await U.launch();const A=await H.newPage(br);await A.setViewportSize({width:1440,height:900});await H.login(A,'admin@uat.test','pw');
 // customers and parts added in random order -> must appear A-Z
 for(const n of ['Zeta Corp','acme aerospace','Borealis Motors'])await H.addCustomer(A,n);
 await H.addPart(A,'acme aerospace','AC-10','Ten');await H.addPart(A,'acme aerospace','AC-2','Two');await H.addPart(A,'acme aerospace','AC-1','One');await H.addPart(A,'Borealis Motors','BM-77','Housing');
 const opts=sel=>A.$$eval(sel+' option',o=>o.map(x=>x.textContent.trim()).filter(x=>x&&!/^(Select|All|—)/.test(x)));
 await H.nav(A,'masters');await A.click('[data-master-tab="customers"]');await sl(300);
 const custRows=await A.evaluate(()=>S.customers.map(c=>c.name));
 ok('LN-1',JSON.stringify(custRows)===JSON.stringify(['acme aerospace','Borealis Motors','Zeta Corp']),'customers are kept A-Z (case-insensitive)',JSON.stringify(custRows));
 await A.click('[data-master-tab="parts"]');await sl(300);
 const pcust=await opts('#newPartCust');ok('LN-2',JSON.stringify(pcust)===JSON.stringify(['acme aerospace','Borealis Motors','Zeta Corp']),'Part Master customer list is A-Z',JSON.stringify(pcust));
 const parts=await A.evaluate(()=>S.parts.map(p=>p.partNo));ok('LN-3',JSON.stringify(parts)===JSON.stringify(['AC-1','AC-2','AC-10','BM-77']),'parts are sorted by customer, then part number in natural order (AC-2 before AC-10)',JSON.stringify(parts));
 await H.nav(A,'orders');await A.click('#newOrderBtn');await sl(300);
 const ocust=await opts('[data-f="customerName"]');ok('LN-4',JSON.stringify(ocust)===JSON.stringify(['acme aerospace','Borealis Motors','Zeta Corp']),'New Order customer dropdown is A-Z',JSON.stringify(ocust));
 await A.selectOption('[data-f="customerName"]','acme aerospace');await H.put(A,'[data-f="customerPONo"]','LN-PO');await A.click('#wizNextBtn');await sl(400);
 // line 1 filled, line 2 added
 await A.selectOption('[data-f="lines.0.partNo"]','AC-1');await H.put(A,'[data-f="lines.0.poQty"]','1234');await H.put(A,'[data-f="lines.0.indiaRate"]','2.50');await H.put(A,'[data-f="lines.0.usRate"]','4.255');await H.put(A,'[data-f="lines.0.originalDockDate"]','2030-02-01');await H.put(A,'[data-f="lines.0.usSalesOrder"]','SO-1');await H.put(A,'[data-f="lines.0.usQBPO"]','QB-1');await H.put(A,'[data-f="lines.0.additionalNotes"]','note one');
 const hdr=await A.$$eval('.ln-hd span',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()).filter(Boolean));
 ok('LN-5',/Part No/.test(hdr[0])&&hdr.slice(1,9).join('|').replace(/AUTO/g,'').replace(/\s+\|/g,'|').replace(/\s+/g,' ').trim()==='PO Qty|Delivered|In Transit|PO Open Qty|On Dock Date (Original)|On Dock Date Revised|US Sales Order #|US QB PO #','the column headings are the nine you asked for',JSON.stringify(hdr));
 const row=await A.$$eval('.ln.open .ln-sum>div',e=>e.map(x=>x.textContent.replace(/\s+/g,' ').trim()));
 ok('LN-6',/AC-1/.test(row[1])&&row[2]==='1234'&&row[5]==='1234'&&/01 Feb 2030/.test(row[6])&&row[8]==='SO-1'&&row[9]==='QB-1','the one-line summary shows part, qty, delivered, in transit, PO open qty, dock dates and both references',JSON.stringify(row));
 const fields=await A.evaluate(()=>['lineNo','partNo','poQty','shortCloseQty','shipmentType','inTransitDays','originalDockDate','shipDate1','revisedShipDate','usSalesOrder','usQBPO','additionalNotes','indiaRate','usRate'].filter(f=>!document.querySelector('.ln.open [data-f="lines.0.'+f+'"]')));
 const autos=await A.$$eval('.ln.open input[readonly]',e=>e.length);
 ok('LN-7',fields.length===0&&autos>=9,'the open line shows every field (nothing hidden behind "More details"); '+autos+' read-only AUTO fields',JSON.stringify(fields));
 // add line 2 -> it opens, line 1 collapses but keeps its values
 await A.click('#addLineBtn');await sl(400);
 const st1=await A.evaluate(()=>({open:[...document.querySelectorAll('.ln')].map(x=>x.classList.contains('open')),inputs0:!!document.querySelector('[data-f="lines.0.poQty"]'),inputs1:!!document.querySelector('[data-f="lines.1.poQty"]')}));
 ok('LN-8',JSON.stringify(st1.open)==='[false,true]'&&!st1.inputs0&&st1.inputs1,'adding a line opens it and closes the other (only one open at a time)',JSON.stringify(st1));
 ok('LN-9',await A.evaluate(()=>(document.querySelector('.ln[data-li="1"] .ln-ic').textContent==='!')&&/choose a part/.test(document.querySelector('.ln[data-li="1"] .ln-part').textContent)),'an incomplete line is marked "!" with "choose a part"');
 await A.selectOption('[data-f="lines.1.partNo"]','AC-2');await H.put(A,'[data-f="lines.1.poQty"]','10');await H.put(A,'[data-f="lines.1.indiaRate"]','1.10');await H.put(A,'[data-f="lines.1.usRate"]','3.333');
 // reopen line 1: its values are still there
 await A.click('.ln[data-li="0"] .ln-sum');await sl(400);
 const back=await A.evaluate(()=>({q:document.querySelector('[data-f="lines.0.poQty"]').value,n:document.querySelector('[data-f="lines.0.additionalNotes"]').value,so:document.querySelector('[data-f="lines.0.usSalesOrder"]').value,ir:document.querySelector('[data-f="lines.0.indiaRate"]').value}));
 ok('LN-10',back.q==='1234'&&back.n==='note one'&&back.so==='SO-1'&&/^2\.5(0)?$/.test(back.ir),'values typed in a line are kept while it is closed and when it is opened again',JSON.stringify(back));
 // click the open line again: it closes (none open)
 await A.click('.ln[data-li="0"] .ln-sum');await sl(300);ok('LN-11',await A.evaluate(()=>document.querySelectorAll('.ln.open').length===0),'clicking the open line closes it');
 // duplicate
 await A.click('.ln[data-li="0"] [data-action="dupLine"]');await sl(400);
 const dup=await A.evaluate(()=>({n:document.querySelectorAll('.ln').length,open:[...document.querySelectorAll('.ln')].findIndex(x=>x.classList.contains('open')),q:document.querySelector('[data-f="lines.2.poQty"]')&&document.querySelector('[data-f="lines.2.poQty"]').value,ln:document.querySelector('[data-f="lines.2.lineNo"]')&&document.querySelector('[data-f="lines.2.lineNo"]').value}));
 ok('LN-12',dup.n===3&&dup.open===2&&dup.q==='1234'&&dup.ln==='3','Duplicate copies the line to the end as line 3 and opens it',JSON.stringify(dup));
 // remove it
 await A.click('.ln[data-li="2"] [data-action="removeLine"]');await sl(400);ok('LN-13',await A.evaluate(()=>document.querySelectorAll('.ln').length===2),'Remove deletes the line');
 // exact totals under the lines: 1234*4.255 + 10*3.333 ; 1234*2.5 + 10*1.1
 const tot=await A.innerText('.ln-tot');ok('LN-14',/US value \$5,284\.00/.test(tot)&&/India value \$3,096\.00/.test(tot)&&/Total qty 1,244/.test(tot),'the totals under the lines are exact with cents ($5,284.00 / $3,096.00)',tot.replace(/\s+/g,' '));
 // Step 3: exact Ext per line and exact Order Summary
 await A.click('#wizNextBtn');await sl(400);
 const rev=await A.innerText('.wiz-main');ok('LN-15',/\$5,250\.67/.test(rev)&&/\$3,085\.00/.test(rev)&&/\$33\.33/.test(rev)&&/\$11\.00/.test(rev),'Step 3 shows exact US Ext / India Ext for every line ($5,250.67, $3,085.00, $33.33, $11.00)',rev.replace(/\s+/g,' ').slice(0,300));
 const sum=await A.innerText('.wiz-summary');ok('LN-16',/US Value\s*\$5,284\.00/.test(sum)&&/India Value \(\$\)\s*\$3,096\.00/.test(sum),'the Order Summary panel shows exact US Value and India Value',sum.replace(/\s+/g,' '));
 ok('LN-17',!/\d\.\dK|\d\.\d\dM/.test(sum+rev),'no rounded K / M figures on the order form');
 // order summary on step 1 too
 await A.evaluate(()=>{S.orderWizStep=1;render();});await sl(300);const sum1=await A.innerText('.wiz-summary');ok('LN-18',/\$5,284\.00/.test(sum1),'Step 1 summary also shows the exact value');
 // new-order step 2 has the whole width (no right-hand panel)
 await A.evaluate(()=>{S.orderWizStep=2;render();});await sl(300);ok('LN-19',await A.evaluate(()=>!document.querySelector('.wiz-summary')&&document.querySelector('.wiz-shell').classList.contains('one')),'Line Items step uses the full width (summary is shown under the lines instead)');
 // save and view: lines show as rows too, with the dashboard cards still in K/M style
 await A.evaluate(()=>{S.orderWizStep=3;render();});await sl(300);await A.click('#saveOrderBtn');await sl(300);await H.confirmModal(A);await sl(800);
 await A.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='LN-PO');S.editing=cloneObj(o);S.page='view-order';render();});await sl(400);
 ok('LN-20',await A.evaluate(()=>document.querySelectorAll('.ln').length===2&&!document.querySelector('.ln .ln-act .b')),'the saved order shows its lines as rows, read-only (no Duplicate / Remove in View)');
 await H.nav(A,'dashboard');await sl(400);ok('LN-21',/\$\d+(\.\d)?K/.test(await A.innerText('.stat-card')),'Dashboard cards keep the short K / M style');
 // other lists are A-Z as well: shipment "Shipped To", filters
 await H.nav(A,'shipments');await A.click('#newShipmentBtn');await sl(300);await A.click('#shipWizNextBtn');await sl(300);
 const shipTo=await opts('[data-sf="slines.0.shippedTo"]');ok('LN-22',JSON.stringify(shipTo)===JSON.stringify(['acme aerospace','Borealis Motors','Zeta Corp']),'the Shipments "Shipped To" list is A-Z',JSON.stringify(shipTo));
 // phone: simple rows and Duplicate inside the open line
 const ctx=await br.newContext({viewport:{width:390,height:844}});const P=await ctx.newPage();
 await P.route('**/*',r=>{const u=r.request().url();if(u==='https://flow.test/run'){const [st,j,txt]=U.gateway(JSON.parse(r.request().postData()));return r.fulfill({status:st,contentType:'application/json',body:typeof txt==='string'?txt:JSON.stringify(j)});}return u.startsWith('file://')?r.continue():r.abort();});
 await P.goto('file://'+process.argv[2]);await P.fill('#lemail','admin@uat.test');await P.fill('#lpass','pw');await P.click('#lbtn');await H.settle(P,800);await sl(600);
 await P.evaluate(()=>{const o=S.orders.find(x=>x.customerPONo==='LN-PO');S.editing=cloneObj(o);S.orderWizStep=2;S.page='edit-order';render();});await sl(500);
 const ph=await P.evaluate(()=>({sw:document.documentElement.scrollWidth,iw:innerWidth,hidden:getComputedStyle(document.querySelector('.ln-hd')).display,dupVisible:[...document.querySelectorAll('.ln.open .ph-only')].some(e=>e.offsetParent!==null),rowFits:[...document.querySelectorAll('.ln-sum')].every(r=>r.getBoundingClientRect().right<=innerWidth+1)}));
 ok('LN-23',ph.sw<=ph.iw+2&&ph.hidden==='none'&&ph.dupVisible&&ph.rowFits,'phone: no sideways scroll, simple rows, Duplicate/Remove inside the open line',JSON.stringify(ph));
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== ORDER LINES / TOTALS / ORDER (mock): ${U.results.length-f.length} passed, ${f.length} failed ===`);await br.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.stack);process.exit(2);});
