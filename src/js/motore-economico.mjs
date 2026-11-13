import { importo, oggiRoma, dataAcquistoEffettiva, dataCessioneEffettiva } from './dati-commerciali.mjs';
export const sposta = (giorno, n) => new Date(Date.parse(giorno+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
export const distanza = (a,b) => Math.round((Date.parse(b)-Date.parse(a))/86400000);
const iso = d => d.toISOString().slice(0,10);
function annoPrima(g) {
    const d = new Date(g+'T00:00:00Z'), mese=d.getUTCMonth();
    d.setUTCFullYear(d.getUTCFullYear()-1);
    if(d.getUTCMonth()!==mese) d.setUTCDate(0);
    return iso(d);
}
export function periodi({tipo, valore, dal, al, confronto='precedente'}, oggi=oggiRoma()) {
    let inizio,fine,primaInizio,primaFine;
    if(tipo==='mese') {
        inizio=valore+'-01'; const d=new Date(inizio+'T00:00:00Z');
        fine=iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)));
        primaInizio=iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-1,1)));
        primaFine=sposta(inizio,-1);
    } else if(tipo==='anno') {
        inizio=valore+'-01-01';fine=valore+'-12-31';
        primaInizio=(Number(valore)-1)+'-01-01';primaFine=(Number(valore)-1)+'-12-31';
    } else if(tipo==='settimana') {
        const [anno,settimana]=valore.split('-W').map(Number);
        const quattro=`${anno}-01-04`, giorno=new Date(quattro+'T00:00:00Z').getUTCDay()||7;
        inizio=sposta(quattro,1-giorno+(settimana-1)*7);fine=sposta(inizio,6);
        primaInizio=sposta(inizio,-7);primaFine=sposta(inizio,-1);
    } else {inizio=dal;fine=al;primaFine=sposta(inizio,-1);primaInizio=sposta(inizio,-(distanza(inizio,fine)+1));}
    if(!inizio||!fine||inizio>fine||inizio>oggi) throw new Error('Seleziona un periodo valido, non interamente futuro.');
    const inCorso=fine>oggi;
    let effettiva=inCorso?oggi:fine;
    if(confronto==='anno-precedente') {primaInizio=annoPrima(inizio);primaFine=annoPrima(fine);}
    if(inCorso && tipo==='anno') {
        // Stessa data civile: gli anni bisestili non devono spostare il confronto.
        primaFine=annoPrima(effettiva);
    } else if(inCorso) {
        const avanzamento=Math.min(distanza(inizio,effettiva),distanza(primaInizio,primaFine));
        effettiva=sposta(inizio,avanzamento);
        primaFine=sposta(primaInizio,avanzamento);
    }
    return {attuale:{inizio,fine:effettiva},precedente:{inizio:primaInizio,fine:primaFine},inCorso};
}
export function movimenti(copie) {
    const eventi=[],qualita={dateMancanti:0,convenzionali:0,importiMancanti:0};
    for(const copia of copie) {
        for(const tipo of ['acquisto','cessione']) {
            if(tipo==='cessione'&&copia.stato!=='ceduto') continue;
            const data=tipo==='acquisto'?dataAcquistoEffettiva(copia):dataCessioneEffettiva(copia);
            const costo=importo(copia.prezzoAcquisto), prezzo=importo(copia.prezzoCessione);
            const valore=tipo==='acquisto'?costo:prezzo;
            if(!data.data) qualita.dateMancanti++;
            if(data.convenzionale) qualita.convenzionali++;
            if(valore===null||valore<0) qualita.importiMancanti++;
            eventi.push({id:copia.id,tipo,data:data.data,convenzionale:data.convenzionale,
                valore:valore!==null&&valore>=0?valore:null,costo:costo!==null&&costo>=0?costo:null});
        }
    }
    return {eventi,qualita};
}
export function riepilogo(eventi, periodo, {parziali=false}={}) {
    const dentro=eventi.filter(e=>e.data&&e.data>=periodo.inizio&&e.data<=periodo.fine);
    const acquisti=dentro.filter(e=>e.tipo==='acquisto'),vendite=dentro.filter(e=>e.tipo==='cessione');
    const totale=righe=>({noto:righe.reduce((s,e)=>s+(e.valore??0),0),mancanti:righe.filter(e=>e.valore===null).length});
    const a=totale(acquisti),r=totale(vendite);
    const valide=vendite.filter(e=>e.valore!==null&&e.costo!==null);
    const costo=valide.reduce((s,e)=>s+e.costo,0), margine=valide.reduce((s,e)=>s+e.valore-e.costo,0);
    const mancanti=vendite.length-valide.length;
    const risultato = {ricavi:r.mancanti?null:r.noto,acquisti:a.mancanti?null:a.noto,
        margine:mancanti?null:margine,roi:mancanti||costo===0?null:margine/costo*100,
        cassa:a.mancanti||r.mancanti?null:r.noto-a.noto,
        noti:{ricavi:r.noto,acquisti:a.noto,margine,cassa:r.noto-a.noto},
        mancanti:{ricavi:r.mancanti,acquisti:a.mancanti,margine:mancanti},
        numero:dentro.length,convenzionali:dentro.filter(e=>e.convenzionale).length};
    risultato.mancanti.roi=mancanti;
    risultato.mancanti.cassa=a.mancanti+r.mancanti;
    if(parziali) {
        if(r.mancanti && vendite.some(e=>e.valore!==null)) risultato.ricavi=r.noto;
        if(a.mancanti && acquisti.some(e=>e.valore!==null)) risultato.acquisti=a.noto;
        if(mancanti && valide.length) risultato.margine=margine;
        if(costo>0) risultato.roi=margine/costo*100;
        if(risultato.mancanti.cassa && dentro.some(e=>e.valore!==null)) risultato.cassa=risultato.noti.cassa;
    }
    return risultato;
}
export function differenza(a,b) {
    if(a===null||b===null) return {assoluta:null,percentuale:null};
    return {assoluta:a-b,percentuale:b===0?null:(a-b)/Math.abs(b)*100};
}
export function serie(eventi, periodo, {mensile=false,parziali=false}={}) {
    const giorni=distanza(periodo.inizio,periodo.fine), gruppi=new Map();
    for(let g=periodo.inizio;g<=periodo.fine;) {
        let fine=g;
        if(giorni>730) fine=g.slice(0,4)+'-12-31';
        else if(mensile||giorni>62) {
            const d=new Date(g+'T00:00:00Z');
            fine=iso(new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)));
        }
        if(fine>periodo.fine) fine=periodo.fine;
        gruppi.set(g,{inizio:g,fine});
        g=sposta(fine,1);
    }
    return [...gruppi.values()].map(p=>({...p,...riepilogo(eventi,p,{parziali})}));
}
export function corrisponde(copia,filtro) {
    if(!filtro) return true;
    return movimenti([copia]).eventi.some(e=>e.data&&e.data>=filtro.inizio&&e.data<=filtro.fine&&
        (filtro.tipo==='entrambi'||e.tipo===filtro.tipo));
}
