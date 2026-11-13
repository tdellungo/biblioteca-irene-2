import { periodi, movimenti, riepilogo, differenza, serie } from './motore-economico.mjs';
const $ = id => document.getElementById(id);
const nomi={ricavi:'Ricavi',acquisti:'Acquisti',margine:'Margine lordo realizzato',roi:'ROI',cassa:'Saldo di cassa'};
const numero = n => new Intl.NumberFormat('it-IT',{maximumFractionDigits:2}).format(n);
const formato=(n,k)=>n===null?'Non calcolabile':`${numero(n)} ${k==='roi'?'%':'€'}`;
let copie=null;
let filtro=null;
let metricaConfronto="ricavi";
function seleziona(inizio,fine,tipo) {
    filtro={inizio,fine,tipo};
    aggiornaFiltro();
    document.querySelector('[data-vista="catalogo"]').click();
    $('filtro-economico').scrollIntoView({block:'start'});
}
function aggiornaFiltro() {
    const area=$('filtro-economico');area.hidden=!filtro;
    if(filtro) {
        area.innerHTML=`<h3>Filtro dal cruscotto</h3>
            <p>Copie con movimenti nel periodo, incluse date convenzionali. Si combina con ricerca e stato del catalogo. Tornando al Cruscotto l’analisi rimane conservata.</p>
            <label>Dal <input type="date" data-campo="inizio"></label>
            <label>Al <input type="date" data-campo="fine"></label>
            <label>Movimento <select data-campo="tipo"><option value="acquisto">Acquisti</option><option value="cessione">Cessioni</option><option value="entrambi">Acquisti e cessioni</option></select></label>
            <button type="button">Cancella filtro economico</button><p role="status"></p>`;
        area.querySelectorAll('[data-campo]').forEach(input=>{
            input.value=filtro[input.dataset.campo];
            input.addEventListener('change',()=>{
                const candidato={...filtro,[input.dataset.campo]:input.value};
                if(!candidato.inizio||!candidato.fine||candidato.inizio>candidato.fine) {
                    area.querySelector('[role="status"]').textContent='Intervallo non valido: rimane applicato il filtro precedente.';return;
                }
                filtro=candidato;area.querySelector('[role="status"]').textContent='Filtro aggiornato.';
                document.dispatchEvent(new CustomEvent('irenus:filtro-economico',{detail:filtro}));
            });
        });
        area.querySelector('button').addEventListener('click',()=>{filtro=null;aggiornaFiltro();});
    }
    document.dispatchEvent(new CustomEvent('irenus:filtro-economico',{detail:filtro}));
}
const tipoMovimento=k=>k==='acquisti'?'acquisto':k==='cassa'?'entrambi':'cessione';
function grafico(titolo,righe,k) {
    const articolo=document.createElement('article');articolo.className='cruscotto-card grafico-economico';
    const h=document.createElement('h4');h.textContent=titolo;articolo.append(h);
    const nota=document.createElement('p');nota.textContent='Seleziona una barra per vedere le copie. Zero al centro; rosso per valori negativi. I valori non calcolabili restano indicati senza barra.';articolo.append(nota);
    const lista=document.createElement('div');lista.className='barre-economiche';
    const max=Math.max(1,...righe.map(r=>Math.abs(r.valore??0)));
    for(const r of righe) {
        const button=document.createElement('button');button.type='button';button.className='barra-riga';
        const testo=`${r.etichetta}: ${formato(r.valore,k)}${r.parziale?' · parziale':''} · ${r.inizio} / ${r.fine}`;
        button.title=testo;button.setAttribute('aria-label',testo);
        const label=document.createElement('span');label.textContent=r.etichetta;
        const pista=document.createElement('span');pista.className='barra-pista';
        const barra=document.createElement('span');barra.className='barra-valore'+(r.valore<0?' negativa':'');
        barra.style.width=`${r.valore===null?0:Math.abs(r.valore)/max*50}%`;pista.append(barra);
        const valore=document.createElement('strong');valore.textContent=formato(r.valore,k)+(r.parziale?' · parziale':'');
        button.append(label,pista,valore);
        button.addEventListener('click',()=>seleziona(r.inizio,r.fine,tipoMovimento(r.k||k)));
        lista.append(button);
    }
    articolo.append(lista);$('grafici-economia').append(articolo);
}
export function aggiornaEconomia() {
    if(copie===null) return;
    const indicatori=$('indicatori-economia'),grafici=$('grafici-economia');
    indicatori.replaceChildren();grafici.replaceChildren();
    if(!$('controlli-periodo').checkValidity()) {
        $('copertura-economia').textContent='Intervallo non valido. Correggi i controlli per visualizzare i dati.';return;
    }
    let p;
    try {p=periodi({tipo:$('periodo-tipo').value,valore:$('periodo-'+$('periodo-tipo').value)?.value,
        dal:$('periodo-dal').value,al:$('periodo-al').value,confronto:$('periodo-confronto').value});}
    catch(e){$('copertura-economia').textContent=e.message;return;}
    const annuale=$('periodo-tipo').value==='anno';
    const opzioni={parziali:annuale,mensile:annuale};
    const {eventi,qualita}=movimenti(copie),a=riepilogo(eventi,p.attuale,opzioni),b=riepilogo(eventi,p.precedente,opzioni);
    $('stato-periodo').textContent=`Periodo ${p.attuale.inizio} / ${p.attuale.fine}; confronto ${p.precedente.inizio} / ${p.precedente.fine}${p.inCorso?(annuale?' · Anno in corso — dati parziali (confronto alla stessa data dell’anno precedente)':' (periodi limitati allo stesso avanzamento in giorni)'):''}.`;
    $('copertura-economia').textContent=`${a.numero} movimenti nel periodo, ${a.convenzionali} con data convenzionale da creato. Copertura catalogo: ${qualita.dateMancanti} movimenti senza data utilizzabile, ${qualita.convenzionali} date convenzionali, ${qualita.importiMancanti} importi mancanti/non validi. ${qualita.dateMancanti?'Totali con copertura storica incompleta: movimenti non databili esclusi.':'La copertura descrive solo i documenti presenti; non certifica lo storico reale.'} Gli importi ignoti non diventano zero.`;
    for(const k of Object.keys(nomi)) {
        const card=document.createElement('article');card.className='cruscotto-card';
        const titolo=document.createElement('h4');titolo.textContent=nomi[k];
        const valore=document.createElement('strong');valore.textContent=formato(a[k],k)+(annuale&&a[k]!==null&&a.mancanti[k]?' · Totale parziale noto':'');
        const delta=differenza(annuale&&a.mancanti[k]?null:a[k],annuale&&b.mancanti[k]?null:b[k]);
        const confronto=document.createElement('p');
        confronto.textContent=`Confronto: ${formato(b[k],k)}${annuale&&b.mancanti[k]?' (dati incompleti)':''}. Differenza: ${delta.assoluta===null?'non calcolabile':numero(delta.assoluta)+(k==='roi'?' punti percentuali':' €')}; variazione: ${delta.percentuale===null?'non calcolabile (base zero o dato incompleto)':numero(delta.percentuale)+'%'}.`;
        card.append(titolo,valore,confronto);
        if(annuale&&a.mancanti[k]) {const nota=document.createElement('p');nota.textContent=`${a.mancanti[k]} movimenti con ${k==='margine'||k==='roi'?'prezzo di cessione o costo di acquisto':'importo'} mancante/non valido. ${a[k]===null?'Nessun contributo sufficiente per determinare l’indicatore.':'Calcolo limitato ai contributi noti; confronto numerico sospeso.'}`;card.append(nota);}
        if(!annuale&&k!=='roi'&&a[k]===null) {const nota=document.createElement('p');nota.textContent=`Totale parziale noto: ${formato(a.noti[k],k)}. Dati mancanti: il totale completo non è determinabile.`;card.append(nota);}
        if(k==='roi'&&a.roi===null){const nota=document.createElement('p');nota.textContent='ROI non definito con costo totale nullo, nessuna vendita o dati incompleti.';card.append(nota);}
        indicatori.append(card);
    }
    const attuale=serie(eventi,p.attuale,opzioni),precedente=serie(eventi,p.precedente,opzioni);
    grafico('Acquisti e ricavi nel tempo',attuale.flatMap(r=>['acquisti','ricavi'].map(k=>({...r,k,parziale:annuale&&r.mancanti[k]>0,valore:r[k],etichetta:`${r.inizio} · ${nomi[k]}`}))),'ricavi');
    for(const k of ['margine','roi','cassa']) {
        const righe=attuale.map(r=>{
            const cumulativo=k==='cassa'||k==='roi';
            const inizio=cumulativo?p.attuale.inizio:r.inizio;
            const dati=cumulativo?riepilogo(eventi,{inizio,fine:r.fine},opzioni):r;
            return {...r,inizio,parziale:annuale&&dati.mancanti[k]>0,valore:dati[k],etichetta:r.fine};
        });
        grafico(k==='cassa'?'Saldo di cassa cumulativo (dal principio del periodo)':k==='roi'?'ROI cumulativo realizzato':nomi[k],righe,k);
    }
    // Stessa scala per entrambe le serie; confronto selezionabile per tutti gli indicatori.
    const k=metricaConfronto;
    const righeConfronto=(righe,periodo,etichetta)=>righe.map(r=>{
        const cumulativo=k==='roi'||k==='cassa';
        const inizio=cumulativo?periodo.inizio:r.inizio;
        const dati=cumulativo?riepilogo(eventi,{inizio,fine:r.fine},opzioni):r;
        return {...r,inizio,k,parziale:annuale&&dati.mancanti[k]>0,valore:dati[k],etichetta:`${etichetta} · ${r.fine}`};
    });
    grafico('Confronto temporale',[
        ...righeConfronto(attuale,p.attuale,'Attuale'),
        ...righeConfronto(precedente,p.precedente,'Confronto')
    ],k);
    const etichetta=document.createElement('label');etichetta.textContent='Indicatore da confrontare ';
    const selettore=document.createElement('select');selettore.id='metrica-confronto';
    for(const [chiave,nome] of Object.entries(nomi)) {
        const opzione=document.createElement('option');opzione.value=chiave;opzione.textContent=nome;selettore.append(opzione);
    }
    selettore.value=k;
    selettore.addEventListener('change',()=>{metricaConfronto=selettore.value;aggiornaEconomia();$('metrica-confronto').focus();});
    etichetta.append(selettore);$('grafici-economia').lastElementChild.insertBefore(etichetta,$('grafici-economia').lastElementChild.querySelector('.barre-economiche'));

}
document.addEventListener('irenus:catalogo',e=>{copie=e.detail;aggiornaEconomia();});
if(window.irenusCopie){copie=window.irenusCopie;aggiornaEconomia();}
