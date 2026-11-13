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

test('anno corrente fino a oggi, confronto civile omogeneo anche bisestile',()=>{
 for(const confronto of ['precedente','anno-precedente']) {
  for(const [oggi,prima] of [['2024-02-29','2023-02-28'],['2024-03-15','2023-03-15'],['2025-03-15','2024-03-15'],['2026-01-01','2025-01-01']]) {
   const p=periodi({tipo:'anno',valore:oggi.slice(0,4),confronto},oggi);
   assert.equal(p.attuale.fine,oggi);assert.equal(p.precedente.fine,prima);assert.equal(p.inCorso,true);
  }
 }
});
test('anno precedente completo, nessun movimento e grafico sempre mensile',()=>{
 const p=periodi({tipo:'anno',valore:'2025'},'2026-02-15');
 assert.deepEqual(p,{attuale:{inizio:'2025-01-01',fine:'2025-12-31'},precedente:{inizio:'2024-01-01',fine:'2024-12-31'},inCorso:false});
 const r=riepilogo([],p.attuale,{parziali:true});
 for(const k of ['ricavi','acquisti','margine','cassa']) assert.equal(r[k],0);
 assert.equal(r.roi,null);assert.equal(serie([],p.attuale,{mensile:true}).length,12);
 const corrente=periodi({tipo:'anno',valore:'2026'},'2026-02-15');
 assert.deepEqual(serie([],corrente.attuale,{mensile:true}).map(r=>[r.inizio,r.fine]),[['2026-01-01','2026-01-31'],['2026-02-01','2026-02-15']]);
});
test('diagnosi annuale: movimento incompleto storico non invalida i contributi noti',()=>{
 const e=movimenti([copia('nota',10,30),copia('ignota',null,null),copia('senza-data',5,9,{dataAcquisto:null,dataCessione:null}),copia('convenzionale',5,10,{dataAcquisto:null,dataCessione:null,creato:'2026-01-01'})]);
 const p=periodi({tipo:'anno',valore:'2026'},'2026-02-15').attuale;
 assert.equal(riepilogo(e.eventi,p).ricavi,null); // comportamento originario
 const r=riepilogo(e.eventi,p,{parziali:true});
 assert.equal(r.ricavi,40);assert.equal(r.acquisti,15);assert.equal(r.margine,25);assert.equal(r.cassa,25);assert.equal(r.roi,25/15*100);
 assert.equal(r.mancanti.ricavi,1);assert.equal(r.mancanti.roi,1);assert.equal(r.convenzionali,2);assert.equal(e.qualita.dateMancanti,2);
 const ignoti=riepilogo(movimenti([copia('ignota',null,null)]).eventi,p,{parziali:true});
 for(const k of ['ricavi','acquisti','margine','roi','cassa']) assert.equal(ignoti[k],null);
});
test('serie annuale: aggregati mensili noti e parziali, esclusione futuro',()=>{
 const e=movimenti([copia('a',10,30),copia('b',null,5),copia('futuro',100,200,{dataAcquisto:'2026-03-01',dataCessione:'2026-03-02'})]).eventi;
 const p=periodi({tipo:'anno',valore:'2026'},'2026-02-15');
 const righe=serie(e,p.attuale,{mensile:true,parziali:true});
 assert.equal(righe.length,2);assert.equal(righe[0].acquisti,10);assert.equal(righe[0].mancanti.acquisti,1);
 assert.equal(righe[1].ricavi,35);assert.equal(righe[1].margine,20);assert.equal(righe[1].mancanti.margine,1);
});
