import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as comuni from '../src/js/dati-commerciali.mjs';

async function applicazione(copia) {
    let sorgente = await readFile(new URL('../src/js/app.js', import.meta.url), 'utf8');
    // Sostituisce solo i confini esterni: niente rete, SDK o database reale.
    sorgente = sorgente.replace(/^import[\s\S]*?from\s+"[^"]+";\n/gm, '').replace(/^caricaLibri\(\);$/m, '');
    const scritture = [], elementi = new Map(), overlay = [];
    const elemento = () => ({ value: '', validity: { valid: true },
        isConnected: true, querySelector: selettore => document.querySelector(selettore),
        addEventListener() {}, remove() {}, classList: { add() {}, remove() {} } });
    const document = {
        querySelector(selettore) {
            if (!elementi.has(selettore)) elementi.set(selettore, elemento());
            return elementi.get(selettore);
        },
        querySelectorAll() { return []; },
        createElement() { const nodo = elemento(); overlay.push(nodo); return nodo; },
        body: { appendChild() {} }
    };
    const contesto = vm.createContext({ ...comuni, document, console,
        initializeApp() {}, getFirestore() {}, collection() {},
        updateDoc: async (riferimento, dati) => scritture.push({ riferimento, dati }),
        addDoc() { throw new Error('Creazione inattesa'); }, doc: (...args) => args,
        alert(messaggio) { throw new Error(messaggio); } });
    contesto.window = contesto;
    vm.runInContext(sorgente, contesto);
    contesto.copiaTest = copia;
    vm.runInContext('libri = [copiaTest]', contesto);
    return { contesto, document, scritture, overlay };
}

test('scheda e modifica mostrano fallback distinti senza scritture; zero visibile', async () => {
    const app = await applicazione({ id: 'sintetico', titolo: 'Test', stato: 'ceduto', creato: '2025-01-01', prezzoAcquisto: 0, prezzoCessione: 0 });
    app.contesto.mostraScheda('sintetico');
    assert.match(app.overlay.at(-1).innerHTML, /Data inserimento/);
    assert.match(app.overlay.at(-1).innerHTML, /Data acquisto/);
    assert.match(app.overlay.at(-1).innerHTML, /01\/01\/2025 \(convenzionale, da creato\)/);
    assert.match(app.overlay.at(-1).innerHTML, /€0\.00/);
    app.contesto.modificaLibro('sintetico');
    assert.match(app.overlay.at(-1).innerHTML, /id="edit-dataAcquisto"\s+value=""/);
    assert.equal(app.scritture.length, 0);
});

test('salvataggio singolo: nessun backfill, creato e dati commerciali intatti; nuova data solo su modifica esplicita', async () => {
    const copia = { id: 'sintetico', creato: '2025-01-01', prezzoAcquisto: '1.234,56', prezzoCessione: 0, stimaValore: 0, stato: 'ceduto', dataCessione: { seconds: 1735689600 } };
    const app = await applicazione(copia);
    const input = (nome, valore) => { app.document.querySelector('#edit-' + nome).value = valore; };
    input('prezzoAcquisto', '1234.56'); input('prezzoCessione', '0'); input('stimaValore', '0'); input('dataCessione', '2025-01-01');
    app.contesto.mostraScheda = () => {};
    await app.contesto.salvaModificaLibro('sintetico');
    assert.equal(app.scritture.length, 1);
    for (const campo of ['creato', 'dataAcquisto', 'prezzoAcquisto', 'prezzoCessione', 'stimaValore', 'dataCessione']) assert.equal(campo in app.scritture[0].dati, false, campo);
    input('dataAcquisto', '2024-12-01');
    await app.contesto.salvaModificaLibro('sintetico');
    assert.equal(app.scritture[1].dati.dataAcquisto, '2024-12-01');
    assert.equal(app.scritture[1].riferimento.at(-1), 'sintetico');
    assert.equal(copia.creato, '2025-01-01');
});

test('data acquisto invalida blocca il salvataggio', async () => {
    const app = await applicazione({ id: 'sintetico' });
    app.document.querySelector('#edit-dataAcquisto').value = '2026-02-30';
    await assert.rejects(app.contesto.salvaModificaLibro('sintetico'), /data di acquisto valida/);
    assert.equal(app.scritture.length, 0);
});
