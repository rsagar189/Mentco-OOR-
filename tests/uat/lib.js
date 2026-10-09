// UAT harness: runs the real index.html in headless Chrome against either a mock gateway or the real flow
let chromium;try{({chromium}=require('playwright'));}catch{({chromium}=require('/opt/node-tools/node_modules/playwright'));}
const crypto=require('crypto');const {execFileSync}=require('child_process');const fs=require('fs');
const HASH=(e,p)=>crypto.pbkdf2Sync(p,'mentco-po:'+String(e).toLowerCase(),150000,32,'sha256').toString('hex');
const PERM=JSON.parse(fs.readFileSync(__dirname+'/perm.json','utf8'));
const MODE=process.env.UAT_MODE||'mock';
const REAL_URL=process.env.POM_FLOW_URL;
// ---- mock gateway
const DB={};let nid=1;const sessions={};const L=n=>DB[n]=DB[n]||[];
function seedMock(){L('POM_Users').push({ID:nid++,Title:'admin@uat.test',POM_Data:JSON.stringify({id:1,name:'UAT Admin',email:'admin@uat.test',passHash:HASH('admin@uat.test','pw'),role:'Admin'})});}
const OLD_FLOW=process.env.MOCK_OLD_FLOW==='1',CAP=parseInt(process.env.MOCK_CAP||'5000');
const FAIL={action:null,remaining:0};
function applyQuery(items,q){
  const p={};String(q).split('&').forEach(x=>{const i=x.indexOf('=');if(i>0)p[x.slice(0,i)]=x.slice(i+1);});
  let out=items.slice();
  if(p.$filter){
    for(const c of p.$filter.replace(/substringof\(('(?:[^']|'')*'),(\w+)\)/g,'SUBSTR[$1][$2]').replace(/[()]/g,'').split(/ and /)){
      const sm=c.trim().match(/^SUBSTR\['(.*)'\]\[(\w+)\]$/);if(sm){const nd=sm[1].replace(/''/g,"'").toLowerCase();out=out.filter(it=>String(it[sm[2]]||'').toLowerCase().includes(nd));continue;}
      const m=c.trim().match(/^(\w+) (gt|lt|ge|le|eq) (.+)$/);if(!m)continue;
      const [,f,op,raw]=m;let v=raw;const dm=raw.match(/^datetime'([^']*)'$/);
      if(dm)v=dm[1].slice(0,10);else if(/^'.*'$/.test(raw))v=raw.slice(1,-1);else v=Number(raw);
      out=out.filter(it=>{let x=f==='Id'?it.ID:it[f];if(x==null)return false;if(dm)x=String(x).slice(0,10);
        return op==='gt'?x>v:op==='lt'?x<v:op==='ge'?x>=v:op==='le'?x<=v:x===v;});
    }
  }
  const desc=/Id desc/.test(p.$orderby||'');out.sort((a,b)=>desc?b.ID-a.ID:a.ID-b.ID);
  const top=parseInt(p.$top||'100000');return out.slice(0,top);
}
const colsOf=b=>{try{return b.Cols?JSON.parse(b.Cols):{};}catch{return{};}};
function mockGw(b){
 if(b.action==='login'){
   const u=L('POM_Users').find(x=>x.Title===b.email);const d=u&&JSON.parse(u.POM_Data);
   const HARD=process.env.MOCK_HARDENED==='1';
   const locked=HARD&&d&&d.lockUntil&&d.lockUntil>new Date().toISOString();
   if(d&&d.passHash===b.passHash&&!locked){
     if(HARD&&(d.fails||0)>0){d.fails=0;d.lockUntil='';u.POM_Data=JSON.stringify(d);}
     const t='tok'+Math.random();sessions[t]={role:d.role,email:d.email};return[200,{token:t,user:{id:d.id,name:d.name,email:d.email,role:d.role}}];}
   if(HARD&&locked)return[429,{error:'Too many failed attempts. Try again in 15 minutes.'}];
   if(HARD&&d){const n=(d.fails||0)+1;d.fails=n>4?0:n;d.lockUntil=n>4?new Date(Date.now()+15*60000).toISOString():'';u.POM_Data=JSON.stringify(d);}
   return[401,{error:'Invalid email or password'}];}
 const s=sessions[b.token];if(!s)return[401,{error:'Session expired'}];
 if(b.action==='logout'){delete sessions[b.token];return[200,{}];}
 if(b.action==='revokeSessions'){if(s.role!=='Admin')return[403,{error:'Not allowed for your role'}];for(const k of Object.keys(sessions))if(sessions[k].email===String(b.email).toLowerCase())delete sessions[k];return[200,{}];}
 if(!(PERM[b.action]?.[b.listName]||'').split(',').includes(s.role))return[403,{error:'Not allowed for your role'}];
 if(FAIL.action===b.action&&FAIL.remaining>0){FAIL.remaining--;return[500,{error:'simulated outage'}];}
 const l=L(b.listName);
 if(b.action==='getItems'){
   if(OLD_FLOW||!b.query)return[200,{value:l.slice(0,CAP)}];
   return[200,{value:applyQuery(l,b.query)}];}
 if(b.action==='createItem'){const it={ID:nid,Id:nid,Title:b.Title,POM_Data:b.POM_Data,...(OLD_FLOW?{}:colsOf(b))};nid++;l.push(it);return[200,it];}
 if(b.action==='updateItem'){const it=l.find(x=>x.ID==b.itemId);it.Title=b.Title;it.POM_Data=b.POM_Data;if(!OLD_FLOW)Object.assign(it,colsOf(b));return[200,{}];}
 if(b.action==='deleteItem'){DB[b.listName]=l.filter(x=>x.ID!=b.itemId);return[200,{}];}
}
function seedRow(list,title,data,cols){const it={ID:nid,Id:nid,Title:title,POM_Data:typeof data==='string'?data:JSON.stringify(data),...(cols||{})};nid++;L(list).push(it);return it;}
// ---- real flow relay (via curl so the container proxy is used; URL never printed)
function realGw(body){
 let out;
 try{out=execFileSync('curl',['-sS','-m','90','-X','POST','-H','Content-Type: application/json','--data-binary','@-','-w','\n%{http_code}',REAL_URL],{input:JSON.stringify(body),env:process.env,maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']}).toString();}
 catch(e){throw new Error('curl failed: '+String(e.stderr||'').split('\n')[0].replace(REAL_URL,'<flow-url>').slice(0,200));}
 const i=out.lastIndexOf('\n');const code=parseInt(out.slice(i+1));let txt=out.slice(0,i);let j;try{j=JSON.parse(txt)}catch{j=txt}
 return[code,j,txt];
}
const calls=[];
function gateway(b){const r=MODE==='real'?realGw(b):mockGw(b);calls.push({a:b.action,l:b.listName,s:r[0],bytes:b.action==='getItems'?JSON.stringify(r[1]).length:0});return r;}
async function launch(){
 const br=await chromium.launch({executablePath:process.env.UAT_CHROME||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});return br;}
async function openApp(br,file){
 const ctx=await br.newContext({viewport:{width:1500,height:1000},acceptDownloads:true});const pg=await ctx.newPage();pg.errs=[];pg.on('pageerror',e=>pg.errs.push(e.message));pg.on('dialog',d=>d.accept());
 await pg.route('**/*',r=>{const u=r.request().url();
  if(u==='https://flow.test/run'){const b=JSON.parse(r.request().postData());const [st,j,txt]=gateway(b);return r.fulfill({status:st,contentType:'application/json',body:typeof txt==='string'?txt:JSON.stringify(j)});}
  return u.startsWith('file://')?r.continue():r.abort();});
 await pg.goto('file://'+file);return pg;}
const results=[];
function ok(id,cond,msg,extra){results.push({id,pass:!!cond,msg,extra});console.log((cond?'PASS ':'FAIL ')+id+' '+msg+(cond?'':'  '+(extra||'')));}
module.exports={launch,openApp,ok,results,HASH,MODE,DB,sessions,L,seedMock,calls,gateway,seedRow,FAIL};
