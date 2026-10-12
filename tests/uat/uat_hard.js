// Lockout + sign-out-on-change. Mock: MOCK_HARDENED=1 UAT_MODE=mock ; Real: needs the flow steps in docs/FLOW_HARDENING.md applied
const U=require('./lib');const H=require('./helpers');const {ok,MODE}=U;const {settle,newPage,login,nav,sleep}=H;
const ADM=MODE==='real'?process.env.POM_UAT_ADMIN_EMAIL:'admin@uat.test',APW=MODE==='real'?process.env.POM_UAT_ADMIN_PASSWORD:'pw';
const TE='uat-lock@example.com',TP='Lock-test-Pw1!',TP2='Lock-test-Pw2!';
const rawLogin=(e,p)=>U.gateway({action:'login',listName:'',token:'',email:e.toLowerCase(),passHash:U.HASH(e,p)});
const tokOk=t=>U.gateway({action:'getItems',listName:'POM_Customers',token:t})[0]===200;
(async()=>{
 if(MODE==='mock')U.seedMock();
 const br=await U.launch();const A=await newPage(br);await login(A,ADM,APW);
 const addUser=async(name,email,pw,role)=>{await nav(A,'users');await A.fill('#uName',name);await A.fill('#uEmail',email);await A.fill('#uPassword',pw);await A.selectOption('#uRole',role);await A.click('#saveUserBtn');await settle(A,800);await sleep(300);};
 const edit=async(email,fn)=>{await nav(A,'users');const id=await A.evaluate(e=>USERS.find(u=>u.email===e).id,email);await A.evaluate(id=>{S.userEdit=id;render();},id);await sleep(200);await fn();await A.click('#saveUserBtn');await settle(A,1500);await sleep(500);};
 await addUser('UAT Lock',TE,TP,'Staff');
 // --- lockout
 const wrong=[];for(let i=0;i<5;i++)wrong.push(rawLogin(TE,'wrong-'+i)[0]);
 ok('LOCK-1',wrong.every(c=>c===401),'five wrong passwords are each refused (401)',JSON.stringify(wrong));
 const locked=rawLogin(TE,TP);
 ok('LOCK-2',locked[0]===429&&/Too many/.test(JSON.stringify(locked[1])),'the 6th try is refused even with the CORRECT password ("Too many failed attempts")',locked[0]+' '+JSON.stringify(locked[1]).slice(0,100));
 const ui=await newPage(br);await login(ui,TE,TP);
 ok('LOCK-3',!(await H.signedIn(ui))&&/Too many/.test(await ui.innerText('#lerr').catch(()=>'')),'the login screen shows the "Too many failed attempts" message',await ui.innerText('#lerr').catch(()=>''));
 await edit(TE,async()=>{await A.fill('#uPassword',TP2);});
 const un=rawLogin(TE,TP2);
 ok('LOCK-4',un[0]===200,'an Admin password reset unlocks the account at once',String(un[0]));
 if(un[0]===200)U.gateway({action:'logout',listName:'',token:un[1].token});
 // counter resets after a good login
 for(let round=0;round<2;round++){for(let i=0;i<4;i++)rawLogin(TE,'bad');const g=rawLogin(TE,TP2);ok('LOCK-5.'+round,g[0]===200,`4 wrong then the right password still works (round ${round+1}: counter was reset by the last good login)`,String(g[0]));if(g[0]===200)U.gateway({action:'logout',listName:'',token:g[1].token});}
 // --- sign-out on change
 const t1=rawLogin(TE,TP2);ok('REV-0',t1[0]===200&&tokOk(t1[1].token),'user signs in and their session works');
 await edit(TE,async()=>{await A.selectOption('#uRole','Viewer1');});
 ok('REV-1',!tokOk(t1[1].token),'after an Admin changes the user\'s role their open session stops working');
 const t2=rawLogin(TE,TP2);ok('REV-2',t2[0]===200&&tokOk(t2[1].token),'they can sign in again with the new role');
 await edit(TE,async()=>{await A.fill('#uPassword',TP);});
 ok('REV-3',!tokOk(t2[1].token),'after a password reset their open session stops working');
 const t3=rawLogin(TE,TP);
 await nav(A,'users');const uid=await A.evaluate(e=>USERS.find(u=>u.email===e).id,TE);
 await A.click(`[data-action="deleteUser"][data-id="${uid}"]`);await sleep(250);await A.click('#modalConfirm');await settle(A,1500);await sleep(600);
 ok('REV-4',t3[0]===200&&!tokOk(t3[1].token),'after an Admin deletes the user their open session stops working at once');
 ok('REV-5',rawLogin(TE,TP)[0]===401,'and they cannot sign in again');
 ok('REV-6',await H.signedIn(A),'the Admin who did all this is still signed in (never signs themselves out)');
 const bad=await A.evaluate(()=>SAVE.failed.map(f=>f.desc+': '+f.msg));ok('REV-7',bad.length===0,'no failed saves or red banners',JSON.stringify(bad));
 // clean-up (any leftovers)
 const adm=U.gateway({action:'login',listName:'',token:'',email:ADM.toLowerCase(),passHash:U.HASH(ADM,APW)});
 if(adm[0]===200){const r=U.gateway({action:'getItems',listName:'POM_Users',token:adm[1].token});for(const i of (r[1].value||[]))if(i.Title===TE)U.gateway({action:'deleteItem',listName:'POM_Users',token:adm[1].token,itemId:i.Id??i.ID});U.gateway({action:'logout',listName:'',token:adm[1].token});}
 const f=U.results.filter(r=>!r.pass);console.log(`\n=== HARDENING (${MODE}): ${U.results.length-f.length} passed, ${f.length} failed ===`);
 await br.close();process.exit(0);
})().catch(e=>{console.error('RUNNER ERROR',String(e.stack||e.message).split(process.env.POM_FLOW_URL||'\u0000').join('<flow-url>'));process.exit(2);});
