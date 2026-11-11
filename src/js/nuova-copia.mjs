import { importo, dataCatalogo, oggiRoma } from './dati-commerciali.mjs';

export function datiNuovaCopia(form, istante = new Date()) {
    const valore = nome => form.elements.namedItem(nome).value.trim();
    const titolo = valore('titolo');
    if (!titolo) throw new Error('Inserisci il titolo.');
    const dataAcquisto = valore('dataAcquisto');
    if (!dataAcquisto || dataCatalogo(dataAcquisto) !== dataAcquisto) {
        throw new Error('Inserisci una data di acquisto valida.');
    }
    const prezzoTesto = valore('prezzoAcquisto');
    const prezzo = importo(prezzoTesto);
    if (prezzoTesto && (prezzo === null || prezzo < 0)) throw new Error('Inserisci un prezzo valido, anche zero.');
    return {
        titolo, autore: valore('autore'), isbn: valore('isbn'),
        stato: 'collezione', dataAcquisto,
        ...(prezzoTesto ? { prezzoAcquisto: prezzo } : {}),
        creato: istante.toISOString()
    };
}

export function apriNuovaCopia(salva) {
    if (document.querySelector('#nuova-copia')) return;
    const overlay = document.createElement('div');
    overlay.className = 'scheda-overlay';
    overlay.id = 'nuova-copia';
    overlay.innerHTML = `
        <form class="scheda" aria-label="Nuova copia">
            <h2>Nuova copia fisica</h2>
            <div class="form-grid">
                <label>Titolo <input name="titolo" required></label>
                <label>Autore <input name="autore"></label>
                <label>ISBN <input name="isbn"></label>
                <label>Prezzo acquisto (€) <input name="prezzoAcquisto" type="number" min="0" step="0.01"></label>
                <label>Data acquisto <input name="dataAcquisto" type="date" value="${oggiRoma()}" required></label>
            </div>
            <p>Viene creata una sola copia, in collezione. Potrai completare gli altri dati con Modifica copia.</p>
            <p role="alert" class="errore-inserimento"></p>
            <div class="scheda-actions">
                <button type="button" class="annulla">Annulla</button>
                <button type="submit">Salva nuova copia</button>
            </div>
        </form>`;
    const form = overlay.querySelector('form');
    overlay.querySelector('.annulla').addEventListener('click', () => overlay.remove());
    form.addEventListener('submit', async evento => {
        evento.preventDefault();
        if (!form.reportValidity()) return;
        const pulsante = form.querySelector('[type="submit"]');
        if (pulsante.disabled) return;
        pulsante.disabled = true;
        try {
            await salva(datiNuovaCopia(form));
            overlay.remove();
        } catch (errore) {
            overlay.querySelector('.errore-inserimento').textContent =
                errore.message || 'Salvataggio non riuscito.';
        } finally {
            pulsante.disabled = false;
        }
    });
    document.body.appendChild(overlay);
}
