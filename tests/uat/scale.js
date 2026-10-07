// Scale test: how does sign-in behave with a realistic 3-year data set?
const U=require('./lib');const H=require('./helpers');
const MODE=process.env.NEWTEST||'on';
const ago=m=>{const d=new Date();d.setMonth(d.getMonth()-m);d.setDate(1+Math.floor(Math.random()*27));return d.toISOString().slice(0,10);};
(async()=>{
 U.seedMock();const br=await U.launch();
 const N_ORD=11000,N_RECENT=3500,N_SHIP=11000,N_AUD=40000;let id=1;const col=MODE==='on';
 const t0=Date.now();
 for(let i=0;i<N_ORD;i++){
  const recent=i>=N_ORD-N_RECENT;const open=(recent&&i%14===0)||(!recent&&i%220===0);
  const date=recent?ago(Math.floor(Math.random()*12)):(open?ago(12+Math.floor(Math.random()*6)):ago(12+Math.floor(Math.random()*24)));
  const o={id:id,customerName:'Customer '+(i%40),customerPONo:'PO-'+id,orderDate:date,buyerName:'Buyer',saved:true,
    lines:[1,2,3].map(n=>({lineNo:n,partNo:'PART-'+(i%300)+'-'+n,poQty:50*n,delivered:open?0:50*n,inTransit:0,shipmentType:'Kan-Ban',inTransitDays:20,originalDockDate:date,additionalNotes:'Typical line note for scale testing purposes. '.repeat(3),lineStatus:'Open',shortCloseQty:0,usSalesOrder:'SO'+i,usQBPO:'QB'+i})) };
  U.seedRow('POM_Orders','PO-'+id,o,col?{Customer:o.customerName,OrderDate:date+'T00:00:00Z',Status:open?'Open':'Closed'}:{});
  U.seedRow('POM_Finance','PO-'+id,{id,rates:[{us:5,in:3},{us:6,in:4},{us:7,in:5}]},col?{OrderDate:date+'T00:00:00Z'}:{});
  id++;
 }
 for(let i=0;i<N_SHIP;i++){const date=ago(Math.floor(i/N_SHIP*36));const s={id:i+1,shippingInvoiceNo:'INV-'+i,dateOfShipping:date,location:'India',saved:true,lines:[{lineNo:1,customerPONo:'PO-'+(1+i%N_ORD),partNo:'P',shippedQty:20,deliveryStatus:'Delivered',deliveryDate:date,heatNo:'H'+i}]};
  U.seedRow('POM_Shipments','INV-'+i,s,col?{ShipDate:date+'T00:00:00Z',Status:'Delivered'}:{});}
 for(let i=0;i<N_AUD;i++)U.seedRow('POM_AuditLog',String(i+1),{id:i+1,type:'order',refId:1+i%N_ORD,refNo:'PO-'+(1+i%N_ORD),timestamp:new Date().toISOString(),userName:'User',userRole:'Staff',action:'Updated',changes:[{field:'Line 1 PO Qty',from:'10',to:'20'}]});
 const seedMs=Date.now()-t0;
 const A=await H.newPage(br);U.calls.length=0;
 const t1=Date.now();await H.login(A,'admin@uat.test','pw');const ms=Date.now()-t1;
 const st=await A.evaluate(()=>({orders:S.orders.length,ships:S.shipments.length,audit:S.auditLog.length,warn:(S.loadWarnings||[]).length,heap:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null}));
 const gets=U.calls.filter(c=>c.a==='getItems');const mb=gets.reduce((a,c)=>a+c.bytes,0)/1048576;
 console.log(JSON.stringify({mode:MODE,cap:process.env.MOCK_CAP||5000,old:process.env.MOCK_OLD_FLOW==='1',seeded:{orders:N_ORD,shipments:N_SHIP,audit:N_AUD},loaded:st,flowCalls:gets.length,downloadMB:+mb.toFixed(1),browserSignInMs:ms,heapMB:st.heap}));
 await br.close();process.exit(0);
})().catch(e=>{console.error('ERR',e.stack||e.message);process.exit(2);});
