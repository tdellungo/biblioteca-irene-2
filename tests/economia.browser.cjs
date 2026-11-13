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
 const copie=[
 {id:'a',titolo:'Positiva',stato:'ceduto',dataAcquisto:'2026-01-15',dataCessione:'2026-02-10',prezzoAcquisto:10,prezzoCessione:30},
 {id:'b',titolo:'Negativa',stato:'ceduto',dataAcquisto:'2026-02-03',dataCessione:'2026-02-11',prezzoAcquisto:20,prezzoCessione:5},
 {id:'c',titolo:'Gratuita',stato:'ceduto',dataAcquisto:'2026-02-12',dataCessione:'2026-02-13',prezzoAcquisto:0,prezzoCessione:10}];

 export const getFirestore=()=>({}); export const collection=()=>({});
 export const getDocs=async()=>{window.letture++;return ({docs:copie.map(copia=>({id:copia.id,data:()=>({...copia})}))});};
 export const doc=(...args)=>args;
 export const updateDoc=async(ref,dati)=>{window.scritture.push({tipo:'update',ref,dati});};
 export const addDoc=async(ref,dati)=>{window.scritture.push({tipo:'add',dati});await new Promise(r=>setTimeout(r,400));return {id:'nuova'};};`;
 return r.fulfill({body,contentType:'text/javascript'});
 }
 throw new Error('Richiesta esterna vietata: '+u.hostname);
});
await p.clock.install({time:new Date('2026-02-15T12:00:00Z')});
await p.goto('http://irenus.test/');await p.locator('.libro').first().waitFor();
await p.getByRole('button',{name:'Cruscotto',exact:true}).click();
const card=k=>p.locator('#indicatori-economia article').filter({has:p.locator('h4',{hasText:new RegExp('^'+k+'$')})});
assert.equal(await card('Ricavi').locator('strong').innerText(),'45 €');
assert.equal(await card('Acquisti').locator('strong').innerText(),'20 €');
assert.equal(await card('Margine lordo realizzato').locator('strong').innerText(),'15 €');
assert.equal(await card('ROI').locator('strong').innerText(),'50 %');
assert.equal(await card('Saldo di cassa').locator('strong').innerText(),'25 €');
assert.match(await p.locator('#stato-periodo').innerText(),/2026-01-15/);
const letture=await p.evaluate(()=>letture);
await p.locator('#grafici-economia article').first().getByRole('button',{name:/2026-02-03 · Acquisti/}).click();
assert.equal(await p.locator('.libro').count(),1);
assert.match(await p.locator('.libro').innerText(),/Negativa/);
assert.equal(await p.locator('#filtro-economico').isVisible(),true);
await p.locator('[data-campo="inizio"]').fill('2026-02-01');
await p.locator('[data-campo="fine"]').fill('2026-02-15');
await p.locator('[data-campo="tipo"]').selectOption('cessione');
assert.equal(await p.locator('.libro').count(),3);
await p.getByRole('button',{name:'Cancella filtro economico'}).click();
assert.equal(await p.locator('#filtro-economico').isVisible(),false);
await p.getByRole('button',{name:'Cruscotto',exact:true}).click();
assert.equal(await p.locator('#periodo-mese').inputValue(),'2026-02');
const cassa=p.locator('#grafici-economia article').filter({has:p.locator('h4',{hasText:'Saldo di cassa cumulativo'})});
await cassa.getByRole('button').last().click();
assert.equal(await p.locator('[data-campo="tipo"]').inputValue(),'entrambi');
assert.equal(await p.locator('.libro').count(),3);
await p.getByRole('button',{name:'Cruscotto',exact:true}).click();
for(const width of [1280,390,320]) {
 await p.setViewportSize({width,height:850});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await p.locator('#grafici-economia article').count(),5);
}
for(const metrica of ['ricavi','acquisti','margine','roi','cassa']) {
 await p.locator('#metrica-confronto').selectOption(metrica);
 assert.equal(await p.locator('#metrica-confronto').inputValue(),metrica);
}
// Le barre del confronto conservano le date del periodo precedente.
await p.locator('#metrica-confronto').selectOption('acquisti');
await p.locator('#grafici-economia article').last().getByRole('button',{name:/Confronto · 2026-01-15/}).click();
assert.equal(await p.locator('.libro').count(),1);
assert.match(await p.locator('.libro').innerText(),/Positiva/);
await p.getByRole('button',{name:'Cruscotto',exact:true}).click();
// Anno corrente, grafici mensili, confronto e ritorno al mese senza alterazioni.
await p.locator('#periodo-tipo').selectOption('anno');
assert.match(await p.locator('#stato-periodo').innerText(),/Anno in corso — dati parziali/);
assert.match(await p.locator('#stato-periodo').innerText(),/2025-01-01 \/ 2025-02-15/);
assert.equal(await card('Acquisti').locator('strong').innerText(),'30 €');
assert.equal(await card('Saldo di cassa').locator('strong').innerText(),'15 €');
assert.equal(await p.locator('#grafici-economia article').first().getByRole('button').count(),4);
assert.equal(await p.locator('#grafici-economia article').nth(1).getByRole('button').count(),2);
assert.match(await p.locator('#grafici-economia article').first().innerText(),/2026-01-01/);
for(const width of [1280,390,320]) {
 await p.setViewportSize({width,height:850});
 assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
}
await p.locator('#periodo-anno').fill('2025');
assert.match(await p.locator('#stato-periodo').innerText(),/2025-01-01 \/ 2025-12-31/);
assert.doesNotMatch(await p.locator('#stato-periodo').innerText(),/Anno in corso/);
assert.equal(await card('Ricavi').locator('strong').innerText(),'0 €');
assert.equal(await card('ROI').locator('strong').innerText(),'Non calcolabile');
assert.equal(await p.locator('#grafici-economia article').first().getByRole('button').count(),24);
await p.locator('#periodo-anno').fill('2026');
await p.locator('#periodo-tipo').selectOption('mese');
assert.equal(await card('Acquisti').locator('strong').innerText(),'20 €');
assert.equal(await card('Saldo di cassa').locator('strong').innerText(),'25 €');
assert.equal(await p.locator('#grafici-economia article').first().getByRole('button').count(),30);
await p.evaluate(()=>document.dispatchEvent(new CustomEvent('irenus:catalogo',{detail:[{id:'incompleta',stato:'ceduto',creato:'2026-02-01',prezzoCessione:10}]})));
assert.equal(await card('Margine lordo realizzato').locator('strong').innerText(),'Non calcolabile');
assert.match(await p.locator('#copertura-economia').innerText(),/2 date convenzionali/);
await p.locator('#periodo-tipo').selectOption('anno');
assert.equal(await card('Ricavi').locator('strong').innerText(),'10 €');
assert.equal(await card('Margine lordo realizzato').locator('strong').innerText(),'Non calcolabile');
assert.match(await card('Margine lordo realizzato').innerText(),/costo di acquisto mancante/);
await p.evaluate(()=>document.dispatchEvent(new CustomEvent('irenus:catalogo',{detail:[
 {id:'nota',stato:'ceduto',dataAcquisto:'2026-01-01',dataCessione:'2026-02-01',prezzoAcquisto:10,prezzoCessione:30},
 {id:'ignota',stato:'ceduto',dataAcquisto:'2026-01-01',dataCessione:'2026-02-01'}
]})));
assert.equal(await card('Ricavi').locator('strong').innerText(),'30 € · Totale parziale noto');
assert.equal(await card('ROI').locator('strong').innerText(),'200 % · Totale parziale noto');
assert.match(await card('Ricavi').innerText(),/Differenza: non calcolabile/);
assert.match(await p.locator('#grafici-economia').innerText(),/parziale/);
assert.equal(await p.evaluate(()=>scritture.length),0);
assert.equal(await p.evaluate(()=>letture),letture);
assert.deepEqual(errors,[]);
console.log('PASS economia Chromium: indicatori reali da fixture, grafici selezionabili, filtri modificabili/cancellabili, contesto conservato, cassa acquisti+cessioni, dati parziali, mobile, nessuna scrittura o rilettura Firestore.');
}finally{await b.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
