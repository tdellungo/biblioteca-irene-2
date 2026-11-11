const {chromium}=require('playwright');
const fs=require('fs/promises');const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,timeout:15000});
try {
const c=await b.newContext({timezoneId:'Europe/Rome'});const p=await c.newPage();
const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/*',async r=>{
 const u=new URL(r.request().url());
 if(u.hostname==='irenus.test') {
 const path=u.pathname==='/'?'index.html':u.pathname.slice(1);
 try {const body=await fs.readFile(root+'/'+path);return r.fulfill({body,contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':'text/javascript'});}catch{return r.fulfill({status:404,body:''});}
 }
 if(u.hostname==='www.gstatic.com') {
 const body=u.pathname.endsWith('firebase-app.js')?'export const initializeApp=()=>({});':`
 window.scritture=[]; window.letture=0;
 const copia={id:'vecchia',titolo:'Libro sintetico',autore:'Autore',isbn:'123',stato:'ceduto',creato:'2025-01-01',prezzoAcquisto:'1.234,56',prezzoCessione:0,stimaValore:0};
 export const getFirestore=()=>({}); export const collection=()=>({});
 export const getDocs=async()=>{window.letture++;return ({docs:[{id:copia.id,data:()=>({...copia})}]});};
 export const doc=(...args)=>args;
 export const updateDoc=async(ref,dati)=>{window.scritture.push({tipo:'update',ref,dati});};
 export const addDoc=async(ref,dati)=>{window.scritture.push({tipo:'add',dati});await new Promise(r=>setTimeout(r,400));return {id:'nuova'};};`;
 return r.fulfill({body,contentType:'text/javascript'});
 }
 throw new Error('Richiesta esterna vietata: '+u.hostname);
});
await p.goto('http://irenus.test/');
await p.locator('.libro').waitFor();
assert.equal(await p.locator('#vista-catalogo').isVisible(),true);
assert.equal(await p.locator('#vista-cruscotto').isVisible(),false);
await p.locator('#search-filter').fill('Libro sintetico');
const letture=await p.evaluate(()=>letture);
for(const larghezza of [1280,390,320]) {
 await p.setViewportSize({width:larghezza,height:850});
 await p.getByRole('button',{name:'Cruscotto',exact:true}).click();
 assert.equal(await p.locator('#vista-catalogo').isVisible(),false);
 for(const [nome,id] of [['Economia','economia'],['Magazzino','magazzino'],['Opportunità','opportunita']]) {
  await p.getByRole('button',{name:nome,exact:true}).click();
  assert.equal(await p.locator('#pannello-'+id).isVisible(),true);
  assert.equal(await p.locator('.cruscotto-pannello:visible').count(),1);
  assert.equal(await p.locator('.cruscotto-card:visible').count(),id==='economia'?10:3);
 }
 for(const tipo of ['settimana','mese','anno','personalizzato']) {
  await p.locator('#periodo-tipo').selectOption(tipo);
  assert.equal(await p.locator('[data-periodo="'+tipo+'"]:visible').count(),tipo==='personalizzato'?2:1);
 }
 await p.locator('#periodo-dal').fill('2026-11-10');
 await p.locator('#periodo-al').fill('2026-11-01');
 assert.match(await p.locator('#stato-periodo').innerText(),/Completa il periodo/);
 await p.locator('#periodo-al').fill('2026-11-11');
 await p.locator('#periodo-confronto').selectOption('anno-precedente');
 assert.match(await p.locator('#stato-periodo').innerText(),/Periodo /);
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow orizzontale a '+larghezza);
 await p.getByRole('button',{name:'Catalogo',exact:true}).click();
 assert.equal(await p.locator('#search-filter').inputValue(),'Libro sintetico');
 assert.equal(await p.locator('.libro').count(),1);
 assert.equal(await p.evaluate(()=>letture),letture);
 assert.equal(await p.evaluate(()=>scritture.length),0);
}
// Accesso con tastiera alla navigazione.
await p.locator('[data-vista="cruscotto"]').focus();
await p.keyboard.press('Enter');
assert.equal(await p.locator('#vista-cruscotto').isVisible(),true);
assert.equal(await p.locator('#titolo-cruscotto').evaluate(el=>el===document.activeElement),true);
assert.deepEqual(errors,[]);
console.log('PASS cruscotto Chromium: tre sezioni, periodi e confronti, validazione intervallo, tastiera, desktop e mobile 390/320px; catalogo preservato, nessuna rilettura o scrittura Firestore.');
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
