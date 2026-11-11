import test from 'node:test';
import assert from 'node:assert/strict';
import { importo, dataCatalogo, oggiRoma, dataAcquistoEffettiva, dataCessioneEffettiva, giorniVenditaEffettivi, descriviData } from '../src/js/dati-commerciali.mjs';
import { datiNuovaCopia } from '../src/js/nuova-copia.mjs';

test('importi: assenza diversa da zero, formati italiani e decimali, input non validi', () => {
    for (const dato of [null, undefined, '', ' ', false, {}, '12abc', Infinity]) assert.equal(importo(dato), null);
    for (const dato of [0, '0', '0,00', '€ 0.00']) assert.equal(importo(dato), 0);
    assert.equal(importo('1.234,56 €'), 1234.56);
    assert.equal(importo('12,50'), 12.5);
    assert.equal(importo('12.50'), 12.5);
});

test('date: ISO, italiane, Date, millisecondi, Timestamp e Timestamp esportati', () => {
    const istante = new Date('2026-01-01T23:30:00Z');
    for (const dato of [istante, istante.toISOString(), istante.getTime(),
        { toDate: () => istante }, { seconds: istante.getTime() / 1000, nanoseconds: 0 },
        { _seconds: istante.getTime() / 1000, _nanoseconds: 0 }]) {
        assert.equal(dataCatalogo(dato), '2026-01-02');
    }
    assert.equal(dataCatalogo('02/01/2026'), '2026-01-02');
    assert.equal(dataCatalogo('2026-01-01'), '2026-01-01');
    for (const dato of ['', null, '2026-02-30', '31/04/2026', '2026-02-30T00:00:00Z', '01/02/03', {}, true]) assert.equal(dataCatalogo(dato), null);
    assert.equal(oggiRoma(new Date('2026-07-01T22:30:00Z')), '2026-07-02');
});

test('fallback solo per campi assenti; nessuna mutazione e provenienza visibile', () => {
    const copia = Object.freeze({ stato: 'ceduto', creato: '2025-01-01' });
    for (const dato of [dataAcquistoEffettiva(copia), dataCessioneEffettiva(copia)]) {
        assert.equal(dato.data, '2025-01-01');
        assert.equal(dato.convenzionale, true);
        assert.match(descriviData(dato), /convenzionale, da creato/);
    }
    const effettiva = dataAcquistoEffettiva({ ...copia, dataAcquisto: '2024-12-01' });
    assert.equal(effettiva.convenzionale, false);
    assert.match(descriviData(effettiva), /effettiva/);
    assert.equal(dataAcquistoEffettiva({ ...copia, dataAcquisto: 'errata' }).nonValida, true);
    assert.equal(dataCessioneEffettiva({ ...copia, stato: 'vendita' }).data, null);
});

test('tempi reali: esclude cessioni e acquisti convenzionali, date invertite e future', () => {
    const copia = { stato: 'ceduto', creato: '2025-01-01', dataAcquisto: '2025-03-29', dataCessione: '2025-03-31' };
    assert.equal(giorniVenditaEffettivi(copia, '2025-04-01'), 2); // cambio ora legale
    assert.equal(giorniVenditaEffettivi({ ...copia, dataCessione: '' }), null);
    assert.equal(giorniVenditaEffettivi({ ...copia, dataAcquisto: '' }), null);
    assert.equal(giorniVenditaEffettivi({ ...copia, dataAcquisto: '2025-04-01' }), null);
    assert.equal(giorniVenditaEffettivi(copia, '2025-03-30'), null);
});

function form(valori) {
    return { elements: { namedItem: nome => ({ value: valori[nome] ?? '' }) } };
}
test('nuova copia: zero salvato, costo mancante omesso, data modificabile, validazione', () => {
    const valori = { titolo: 'Copia sintetica', dataAcquisto: '2025-01-01', prezzoAcquisto: '0' };
    const copia = datiNuovaCopia(form(valori), new Date('2026-01-01T12:00:00Z'));
    assert.equal(copia.prezzoAcquisto, 0);
    assert.equal(copia.dataAcquisto, '2025-01-01');
    assert.equal(copia.creato, '2026-01-01T12:00:00.000Z');
    assert.equal(copia.stato, 'collezione');
    assert.equal('prezzoAcquisto' in datiNuovaCopia(form({ ...valori, prezzoAcquisto: '' })), false);
    for (const variazione of [{ titolo: '' }, { dataAcquisto: '' }, { dataAcquisto: '2025-02-30' }, { prezzoAcquisto: '-1' }]) {
        assert.throws(() => datiNuovaCopia(form({ ...valori, ...variazione })));
    }
});

test('modulo nuovo: apertura e annullamento non salvano; invio esplicito salva una copia e blocca doppio invio', async () => {
    const { apriNuovaCopia } = await import('../src/js/nuova-copia.mjs');
    const precedente = globalThis.document;
    const creaNodo = () => ({ eventi: {}, disabled: false, addEventListener(nome, callback) { this.eventi[nome] = callback; } });
    const formNodo = { ...creaNodo(), ...form({ titolo: 'Test', dataAcquisto: '2025-01-01' }), reportValidity: () => true };
    const annulla = creaNodo(), submit = creaNodo(), errore = creaNodo();
    formNodo.querySelector = () => submit;
    const overlay = { remove() { this.rimosso = true; }, querySelector(selettore) {
        return { form: formNodo, '.annulla': annulla, '.errore-inserimento': errore }[selettore];
    } };
    let scritture = 0, completa;
    try {
        globalThis.document = { querySelector: () => null, createElement: () => overlay, body: { appendChild() {} } };
        apriNuovaCopia(async () => { scritture++; await new Promise(resolve => { completa = resolve; }); });
        assert.match(overlay.innerHTML, new RegExp(`name="dataAcquisto"[^>]*value="${oggiRoma()}"`));
        assert.equal(scritture, 0);
        annulla.eventi.click();
        assert.equal(overlay.rimosso, true);
        assert.equal(scritture, 0);
        apriNuovaCopia(async () => { scritture++; await new Promise(resolve => { completa = resolve; }); });
        const evento = { preventDefault() {} };
        const invio = formNodo.eventi.submit(evento);
        await formNodo.eventi.submit(evento);
        assert.equal(scritture, 1);
        completa();
        await invio;
        assert.equal(submit.disabled, false);
    } finally { globalThis.document = precedente; }
});
