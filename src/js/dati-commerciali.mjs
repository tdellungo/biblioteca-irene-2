// Normalizzazione in lettura: nessuna funzione modifica i documenti originali.
export const mancante = valore => valore == null ||
    (typeof valore === 'string' && valore.trim() === '');

export function importo(valore) {
    if (mancante(valore) || !['string', 'number'].includes(typeof valore)) return null;
    let testo = String(valore).trim().replace(/\s|€/g, '');
    if (testo.includes(',')) {
        if (!/^[+-]?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{1,2}$/.test(testo)) return null;
        testo = testo.replace(/\./g, '').replace(',', '.');
    }
    if (!/^[+-]?\d+(?:\.\d+)?$/.test(testo)) return null;
    const numero = Number(testo);
    return Number.isFinite(numero) ? numero : null;
}

export function oggiRoma(istante = new Date()) {
    const parti = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(istante);
    const parte = tipo => parti.find(p => p.type === tipo).value;
    return `${parte('year')}-${parte('month')}-${parte('day')}`;
}

function giornoValido(testo) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(testo)) return null;
    const data = new Date(`${testo}T00:00:00Z`);
    return Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === testo ? testo : null;
}

export function dataCatalogo(valore) {
    if (mancante(valore)) return null;
    try {
        if (typeof valore === 'string') {
            const testo = valore.trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(testo)) return giornoValido(testo);
            const italiana = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(testo);
            if (italiana) return giornoValido(`${italiana[3]}-${italiana[2]}-${italiana[1]}`);
            // Non interpretare stringhe ambigue con le regole dipendenti dal browser.
            if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(testo) ||
                !giornoValido(testo.slice(0, 10))) return null;
            valore = new Date(testo);
        } else if (typeof valore?.toDate === 'function') {
            valore = valore.toDate();
        } else if (typeof valore === 'object' && !(valore instanceof Date)) {
            const secondi = valore.seconds ?? valore._seconds;
            const nano = valore.nanoseconds ?? valore._nanoseconds ?? 0;
            if (!Number.isFinite(secondi) || !Number.isFinite(nano) || nano < 0 || nano >= 1e9) return null;
            valore = new Date(secondi * 1000 + nano / 1e6);
        } else if (typeof valore === 'number') {
            valore = new Date(valore); // timestamp numerico JavaScript, in millisecondi
        }
        return valore instanceof Date && Number.isFinite(valore.getTime()) ? oggiRoma(valore) : null;
    } catch {
        return null;
    }
}

function risolviData(copia, campo) {
    if (!mancante(copia[campo])) {
        const data = dataCatalogo(copia[campo]);
        return { data, fonte: campo, convenzionale: false, nonValida: data === null };
    }
    const data = dataCatalogo(copia.creato);
    return { data, fonte: data ? 'creato' : null, convenzionale: data !== null,
        nonValida: !mancante(copia.creato) && data === null };
}

export const dataAcquistoEffettiva = copia => risolviData(copia, 'dataAcquisto');
export const dataCessioneEffettiva = copia => copia.stato === 'ceduto'
    ? risolviData(copia, 'dataCessione')
    : { data: null, fonte: null, convenzionale: false, nonValida: false };

// Prerequisito per future statistiche: nessuna durata inferita da date convenzionali.
export function giorniVenditaEffettivi(copia, oggi = oggiRoma()) {
    const acquisto = dataAcquistoEffettiva(copia);
    const cessione = dataCessioneEffettiva(copia);
    if (!acquisto.data || !cessione.data || acquisto.convenzionale || cessione.convenzionale ||
        acquisto.data > cessione.data || cessione.data > oggi) return null;
    return (Date.parse(cessione.data + 'T00:00:00Z') - Date.parse(acquisto.data + 'T00:00:00Z')) / 86400000;
}

export function descriviData(dato) {
    if (!dato.data) return dato.nonValida ? 'Data non valida' : '—';
    const [anno, mese, giorno] = dato.data.split('-');
    return `${giorno}/${mese}/${anno}${dato.convenzionale ? ' (convenzionale, da creato)' : ' (effettiva)'}`;
}
