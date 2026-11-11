import test from 'node:test';import assert from 'node:assert/strict';
import {periodi,movimenti,riepilogo,differenza,serie,corrisponde} from '../src/js/motore-economico.mjs';
const periodo={inizio:'2026-02-01',fine:'2026-02-28'};
const copia=(id,costo,ricavo,extra={})=>({id,stato:'ceduto',dataAcquisto:'2026-01-15',dataCessione:'2026-02-10',prezzoAcquisto:costo,prezzoCessione:ricavo,...extra});
test('margini positivi/negativi, saldo diverso da utile, costo zero',()=>{
 const dati=[copia('a',10,30),copia('b',20,5),copia('c',0,10),copia('d',40,null,{stato:'collezione',dataAcquisto:'2026-02-01'})];
 const r=riepilogo(movimenti(dati).eventi,periodo);
 assert.equal(r.ricavi,45);assert.equal(r.acquisti,40);assert.equal(r.margine,15);assert.equal(r.roi,50);assert.equal(r.cassa,5);
 assert.equal(riepilogo(movimenti([copia('a',20,5)]).eventi,periodo).roi,-75);
 assert.equal(riepilogo(movimenti([copia('a',0,10)]).eventi,periodo).roi,null);
});
test('costi e ricavi mancanti non diventano zero, note quote parziali',()=>{
 const r=riepilogo(movimenti([copia('a',null,30),copia('b',10,20)]).eventi,periodo);
 assert.equal(r.ricavi,50);assert.equal(r.margine,null);assert.equal(r.noti.margine,10);assert.equal(r.roi,null);
 const s=riepilogo(movimenti([copia('x',null,null,{dataAcquisto:'2026-02-01'})]).eventi,periodo);
 assert.equal(s.ricavi,null);assert.equal(s.acquisti,null);assert.equal(s.cassa,null);
 assert.equal(riepilogo([],periodo).ricavi,0);assert.equal(riepilogo([],periodo).roi,null);
});
test('date convenzionali, mancanti e fuso Roma',()=>{
 const {eventi,qualita}=movimenti([copia('a',1,2,{dataAcquisto:null,dataCessione:null,creato:'2026-01-31T23:30:00Z'}),copia('b',1,2,{dataAcquisto:null,dataCessione:null})]);
 assert.equal(qualita.dateMancanti,2);assert.equal(qualita.convenzionali,2);
 assert.equal(riepilogo(eventi,periodo).convenzionali,2);
 assert.equal(eventi[0].data,'2026-02-01');
});
test('confronti parziali e periodi precedenti, settimane ISO e cambio anno',()=>{
 const p=periodi({tipo:'mese',valore:'2026-01'},'2026-01-11');
 assert.deepEqual(p.attuale,{inizio:'2026-01-01',fine:'2026-01-11'});
 assert.deepEqual(p.precedente,{inizio:'2025-12-01',fine:'2025-12-11'});
 assert.deepEqual(periodi({tipo:'mese',valore:'2026-02'},'2026-03-01').precedente,{inizio:'2026-01-01',fine:'2026-01-31'});
 assert.equal(periodi({tipo:'mese',valore:'2026-01',confronto:'anno-precedente'},'2026-01-11').precedente.fine,'2025-01-11');
 assert.deepEqual(periodi({tipo:'settimana',valore:'2026-W01'},'2026-01-01').attuale,{inizio:'2025-12-29',fine:'2026-01-01'});
 assert.deepEqual(periodi({tipo:'anno',valore:'2026'},'2026-01-11').precedente,{inizio:'2025-01-01',fine:'2025-01-11'});
 assert.equal(periodi({tipo:'mese',valore:'2024-02',confronto:'anno-precedente'},'2024-03-01').precedente.fine,'2023-02-28');
 assert.deepEqual(periodi({tipo:'personalizzato',dal:'2026-01-30',al:'2026-02-02'},'2026-03-01').precedente,{inizio:'2026-01-26',fine:'2026-01-29'});
});
test('differenze assolute, percentuali e base nulla',()=>{
 assert.deepEqual(differenza(10,-10),{assoluta:20,percentuale:200});
 assert.equal(differenza(10,0).percentuale,null);assert.equal(differenza(null,0).assoluta,null);
});
test('serie e filtri distinti per movimento, senza duplicare copie',()=>{
 const c=copia('a',10,20,{dataAcquisto:'2026-02-01'}),e=movimenti([c]).eventi;
 assert.equal(serie(e,periodo).length,28);
 assert.equal(corrisponde(c,{inizio:'2026-02-01',fine:'2026-02-01',tipo:'acquisto'}),true);
 assert.equal(corrisponde(c,{inizio:'2026-02-01',fine:'2026-02-01',tipo:'cessione'}),false);
 assert.equal(corrisponde(c,{...periodo,tipo:'entrambi'}),true);
});

test('mese in corso più lungo del precedente: confronto limitato a uguale numero di giorni',()=>{
 const p=periodi({tipo:'mese',valore:'2026-03'},'2026-03-30');
 assert.deepEqual(p.attuale,{inizio:'2026-03-01',fine:'2026-03-28'});
 assert.deepEqual(p.precedente,{inizio:'2026-02-01',fine:'2026-02-28'});
});
