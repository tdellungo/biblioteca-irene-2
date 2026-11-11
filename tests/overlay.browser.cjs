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
 window.scritture=[];
 const copia={id:'vecchia',titolo:'Libro sintetico',autore:'Autore',isbn:'123',stato:'ceduto',creato:'2025-01-01',prezzoAcquisto:'1.234,56',prezzoCessione:0,stimaValore:0};
 export const getFirestore=()=>({}); export const collection=()=>({});
 export const getDocs=async()=>({docs:[{id:copia.id,data:()=>({...copia})}]});
 export const doc=(...args)=>args;
 export const updateDoc=async(ref,dati)=>{window.scritture.push({tipo:'update',ref,dati});};
 export const addDoc=async(ref,dati)=>{window.scritture.push({tipo:'add',dati});await new Promise(r=>setTimeout(r,400));return {id:'nuova'};};`;
 return r.fulfill({body,contentType:'text/javascript'});
 }
 throw new Error('Richiesta esterna vietata: '+u.hostname);
});
await p.goto('http://irenus.test/');await p.locator('.libro').waitFor();
await p.getByRole('button',{name:'＋ Nuova copia',exact:true}).click();
const today=await p.evaluate(()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome'}).format(new Date()));
assert.equal(await p.locator('[name=dataAcquisto]').inputValue(),today);
await p.locator('[name=dataAcquisto]').fill('2024-12-01');
await p.getByRole('button',{name:'Annulla',exact:true}).click();
assert.equal(await p.evaluate(()=>scritture.length),0);
await p.getByRole('button',{name:'👁 Scheda'}).click();
assert.match(await p.locator('.scheda').innerText(),/convenzionale, da creato/);
await p.getByRole('button',{name:'✏️ Modifica copia'}).click();
assert.equal(await p.locator('#modifica-copia').count(),1);
assert.equal(await p.locator('#scheda-copia').count(),0);
assert.equal(await p.locator('#edit-dataAcquisto').count(),1);
assert.equal(await p.locator('#edit-dataAcquisto').inputValue(),'');
assert.equal(await p.locator('#edit-prezzoAcquisto').inputValue(),'1234.56');
assert.equal(await p.locator('#edit-prezzoCessione').inputValue(),'0');
await p.getByRole('button',{name:'💾 Salva modifiche'}).click();
assert.equal(await p.locator('.scheda-overlay').count(),1);
assert.equal(await p.locator('#modifica-copia').count(),0);
const patch=await p.evaluate(()=>scritture[0].dati);
for(const campo of ['creato','dataAcquisto','prezzoAcquisto','prezzoCessione','stimaValore','dataCessione']) assert.equal(campo in patch,false,campo);
assert.equal(await p.locator('#scheda-copia').count(),1);
await p.getByRole('button',{name:'✏️ Modifica copia'}).click();
assert.equal(await p.locator('#modifica-copia').count(),1);
assert.equal(await p.locator('#scheda-copia').count(),0);
assert.equal(await p.locator('#edit-dataAcquisto').count(),1);
await p.locator('#edit-dataAcquisto').fill('2024-12-01');
await p.getByRole('button',{name:'💾 Salva modifiche'}).click();
assert.equal(await p.evaluate(()=>scritture[1].dati.dataAcquisto),'2024-12-01');
assert.equal(await p.locator('.scheda-overlay').count(),1);
assert.equal(await p.locator('#modifica-copia').count(),0);
await p.getByRole('button',{name:'✏️ Modifica copia'}).click();
assert.equal(await p.locator('#modifica-copia').count(),1);
assert.equal(await p.locator('#scheda-copia').count(),0);
assert.equal(await p.locator('#edit-dataAcquisto').count(),1);
assert.equal(await p.locator('#edit-dataAcquisto').count(),1);
assert.equal(await p.locator('#edit-dataAcquisto').inputValue(),'2024-12-01');
await p.getByRole('button',{name:'Annulla',exact:true}).click();
assert.equal(await p.locator('.scheda-overlay').count(),0);
await p.getByRole('button',{name:'👁 Scheda'}).click();
await p.locator('#scheda-copia .scheda-chiudi-btn').click();
assert.equal(await p.evaluate(()=>scritture.length),2);
assert.equal(await p.locator('.scheda-overlay').count(),0);
await p.getByRole('button',{name:'＋ Nuova copia',exact:true}).click();
await p.locator('[name=titolo]').fill('Nuova sintetica');
await p.locator('[name=dataAcquisto]').fill('2024-12-02');
await p.locator('[name=prezzoAcquisto]').fill('0');
await p.locator('[type=submit]').evaluate(el=>{el.click();el.click();el.form.requestSubmit();});
await p.waitForTimeout(600);
assert.equal(await p.evaluate(()=>scritture.filter(s=>s.tipo==='add').length),1);
assert.equal(await p.evaluate(()=>scritture.find(s=>s.tipo==='add').dati.dataAcquisto),'2024-12-02');
await p.locator('#search-filter').fill('Nuova sintetica');assert.equal(await p.locator('.libro').count(),1);
await p.getByRole('button',{name:'In collezione',exact:true}).click();assert.equal(await p.locator('.libro').count(),1);
assert.deepEqual(errors,[]);
console.log('PASS regressione overlay: due cicli consecutivi senza pulizia artificiale; annullamento e chiusura senza scritture.');
console.log('PASS browser: integrazione, date modificabili, fallback, apertura/annullamento senza scritture, patch conservativa, salvataggio esplicito, doppio invio, ricerca e filtri. Firebase completamente simulato.');
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
