// Solo navigazione locale: non legge né scrive dati del catalogo o di Firestore.
import { oggiRoma } from './dati-commerciali.mjs';

const viste = document.querySelectorAll('[data-vista]');
viste.forEach(pulsante => pulsante.addEventListener('click', () => {
    viste.forEach(voce => {
        const attiva = voce === pulsante;
        voce.setAttribute('aria-pressed', String(attiva));
        document.getElementById(voce.getAttribute('aria-controls')).hidden = !attiva;
    });
    if (pulsante.dataset.vista === 'cruscotto') document.getElementById('titolo-cruscotto').focus();
}));

const sezioni = document.querySelectorAll('[data-pannello]');
sezioni.forEach(pulsante => pulsante.addEventListener('click', () => {
    sezioni.forEach(voce => {
        const attiva = voce === pulsante;
        voce.setAttribute('aria-pressed', String(attiva));
        document.getElementById(voce.getAttribute('aria-controls')).hidden = !attiva;
    });
}));

const oggi = oggiRoma();
document.getElementById('periodo-mese').value = oggi.slice(0, 7);
document.getElementById('periodo-anno').value = oggi.slice(0, 4);
document.getElementById('periodo-dal').value = oggi;
document.getElementById('periodo-al').value = oggi;
// Settimana ISO: usa solo la data civile di Roma, evitando slittamenti di fuso.
const giovedi = new Date(`${oggi}T00:00:00Z`);
giovedi.setUTCDate(giovedi.getUTCDate() + 4 - (giovedi.getUTCDay() || 7));
const annoISO = giovedi.getUTCFullYear();
const settimana = Math.ceil(((giovedi - new Date(Date.UTC(annoISO, 0, 1))) / 86400000 + 1) / 7);
document.getElementById('periodo-settimana').value = `${annoISO}-W${String(settimana).padStart(2, '0')}`;

const form = document.getElementById('controlli-periodo');
function aggiornaControlli() {
    const tipo = document.getElementById('periodo-tipo').value;
    document.querySelectorAll('[data-periodo]').forEach(etichetta => {
        etichetta.hidden = etichetta.dataset.periodo !== tipo;
        etichetta.querySelector('input').disabled = etichetta.hidden;
    });
    const dal = document.getElementById('periodo-dal');
    const al = document.getElementById('periodo-al');
    al.setCustomValidity(tipo === 'personalizzato' && dal.value && al.value && dal.value > al.value
        ? 'La data finale deve seguire o coincidere con quella iniziale.' : '');
    document.getElementById('stato-periodo').textContent = form.checkValidity()
        ? 'Selezione memorizzata nella pagina. Filtri, confronti e calcoli non ancora attivi.'
        : 'Completa il periodo con valori validi e una data finale non precedente a quella iniziale. Nessun filtro applicato.';
}
form.addEventListener('submit', evento => evento.preventDefault());
form.addEventListener('input', aggiornaControlli);
form.addEventListener('change', aggiornaControlli);
