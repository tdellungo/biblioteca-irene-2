import { initializeApp } from "https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js";
import {
    getFirestore,
    collection,
    getDocs,
    doc,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDAoZMono0jmwgPI16uug6L_JjJwYNR8HY",
    authDomain: "biblioteca-famiglia.firebaseapp.com",
    projectId: "biblioteca-famiglia",
    storageBucket: "biblioteca-famiglia.firebasestorage.app",
    messagingSenderId: "943828854447",
    appId: "1:943828854447:web:50ce6c11402886ccc5565a"
};


const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const libriCol = collection(db, "libri");


let libri = [];
let filtro = "all";


async function caricaLibri() {

    const catalogo = document.querySelector(".catalogo");
    const badge = document.querySelector("#sync-badge");

    try {

        const snapshot = await getDocs(libriCol);

        libri = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        console.log("Biblioteca Irene: libri trovati =", libri.length); 
const gruppiISBN = {};

libri.forEach(libro => {

    const isbn = (libro.isbn || "").trim();

    if (!isbn) return;

    if (!gruppiISBN[isbn]) {
        gruppiISBN[isbn] = [];
    }

    gruppiISBN[isbn].push(libro);
});


const isbnMultipli = Object.entries(gruppiISBN)
    .filter(([isbn, copie]) => copie.length > 1);


console.log(
    "ISBN presenti in più copie:",
    isbnMultipli.length
);


const casiConVendite = isbnMultipli
    .filter(([isbn, copie]) =>
        copie.some(copia =>
            copia.stato === "ceduto" &&
            parseFloat(copia.prezzoCessione) > 0
        )
    );


console.log(
    "ISBN multipli con almeno una vendita:",
    casiConVendite.length
);


console.log(
    "===== CASI DI INTERESSE ====="
);


casiConVendite.forEach(([isbn, copie]) => {

    const vendute = copie
        .filter(copia =>
            copia.stato === "ceduto" &&
            parseFloat(copia.prezzoCessione) > 0
        )
        .map(copia => ({
            titolo: copia.titolo,
            prezzo: parseFloat(copia.prezzoCessione),
            variante: copia.variante || "",
            editore: copia.editore || "",
            anno: copia.anno || "",
            id: copia.id
        }));


    console.log(
        "ISBN:",
        isbn,
        "| copie:",
        copie.length,
        "| vendute:",
        vendute.length
    );

    console.table(vendute);

});

        badge.textContent = "● Sincronizzato";
        badge.classList.add("online");

        aggiornaStatistiche();
        mostraLibri();

    } catch (errore) {

        console.error("Errore nel caricamento:", errore);

        badge.textContent = "● Errore connessione";
        badge.classList.add("offline");

        catalogo.innerHTML = `
            <div class="empty-state">
                <h2>Impossibile caricare il catalogo</h2>
                <p>Controlla la connessione e riprova.</p>
            </div>
        `;
    }
}


// TASK 7A — Esportazione manuale dei dati della collezione "libri".
// Operazione di sola lettura: non scrive su Firestore.
async function esportaCatalogoJSON() {
    const pulsante = document.querySelector("#btn-esporta-catalogo");
    if (pulsante?.disabled) return;
    const testoOriginale = pulsante?.textContent;
    if (pulsante) {
        pulsante.disabled = true;
        pulsante.textContent = "Esportazione in corso...";
    }
    try {
        // Lettura diretta della collezione, senza dipendere da filtri o ricerche UI.
        const snapshot = await getDocs(libriCol);
        const documenti = snapshot.docs.map(documento => ({
            id: documento.id,
            dati: documento.data()
        }));
        const esportazione = {
            formato: "irenus-catalogo-json-v1",
            progetto: firebaseConfig.projectId,
            collezione: "libri",
            esportatoIl: new Date().toISOString(),
            numeroDocumenti: documenti.length,
            nota: "Esportazione dei dati applicativi. Non include i metadati Firestore createTime/updateTime, le regole di sicurezza o gli indici.",
            documenti
        };
        const contenuto = JSON.stringify(esportazione, null, 2);
        const blob = new Blob([contenuto], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        const data = new Date();
        const nomeData = [data.getFullYear(), String(data.getMonth() + 1).padStart(2, "0"), String(data.getDate()).padStart(2, "0")].join("-");
        link.href = url;
        link.download = `irenus-catalogo-${nomeData}.json`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        console.info(`IRENUS: esportati ${documenti.length} documenti (sola lettura).`);
        alert(`Esportazione avviata: ${documenti.length} documenti. Verifica che il file JSON sia stato salvato sul Mac.`);
    } catch (errore) {
        console.error("Errore esportazione catalogo:", errore);
        alert("Esportazione non riuscita. Il database non è stato modificato. Controlla la console di Safari.");
    } finally {
        if (pulsante) {
            pulsante.disabled = false;
            pulsante.textContent = testoOriginale;
        }
    }
}
document.querySelector("#btn-esporta-catalogo")?.addEventListener("click", esportaCatalogoJSON);

// TASK 7A — Diagnostica economica di sola lettura.
// Non deduce date mancanti e non scrive su Firestore.
function diagnosticaDatiEconomici() {
    const campiData = [...new Set(libri.flatMap(libro =>
        Object.keys(libro).filter(chiave =>
            /data|date|created|timestamp|inseriment|acquist/i.test(chiave)
        )
    ))].sort();

    const presente = valore => valore !== undefined && valore !== null &&
        String(valore).trim() !== "";
    const conta = campo => libri.filter(libro => presente(libro[campo])).length;
    const date = Object.fromEntries(campiData.map(campo => [campo, conta(campo)]));
    const ceduti = libri.filter(libro => libro.stato === "ceduto");
    const validi = valore => Number.isFinite(Number(valore)) && presente(valore);
    const riepilogo = {
        copieTotali: libri.length,
        copieCedute: ceduti.length,
        costoAcquistoPresente: libri.filter(l => validi(l.prezzoAcquisto)).length,
        prezzoCessioneCedutiPresente: ceduti.filter(l => validi(l.prezzoCessione)).length,
        dataCessioneCedutiPresente: ceduti.filter(l => presente(l.dataCessione)).length,
        campiTemporaliRilevati: date
    };
    console.group("IRENUS — Task 7A: disponibilità dati economici (sola lettura)");
    console.table({
        "Copie totali": riepilogo.copieTotali,
        "Copie cedute": riepilogo.copieCedute,
        "Copie con costo": riepilogo.costoAcquistoPresente,
        "Cedute con prezzo": riepilogo.prezzoCessioneCedutiPresente,
        "Cedute con data cessione": riepilogo.dataCessioneCedutiPresente
    });
    console.table(date);
    console.info("I campi data rilevati non sono automaticamente validati come date di inserimento.");
    console.groupEnd();
    return riepilogo;
}
window.diagnosticaDatiEconomici = diagnosticaDatiEconomici;


function aggiornaStatistiche() {

    const totale = libri.length;

    const titoli = new Set(
        libri.map(libro =>
            (libro.titolo || "").trim().toLowerCase()
        )
    );

    const investito = libri.reduce(
        (totale, libro) =>
            totale + (parseFloat(libro.prezzoAcquisto) || 0),
        0
    );

    const ceduti = libri.filter(
        libro => libro.stato === "ceduto"
    );

    const ricavi = ceduti.reduce(
        (totale, libro) =>
            totale + (parseFloat(libro.prezzoCessione) || 0),
        0
    );


    document.querySelector("#stat-total").textContent = totale;

    document.querySelector("#stat-titoli").textContent =
        titoli.size;

    document.querySelector("#stat-invest").textContent =
        "€" + investito.toFixed(0);

    document.querySelector("#stat-sold").textContent =
        ceduti.length;

    document.querySelector("#stat-out").textContent =
        "€" + ricavi.toFixed(0);
}


function mostraLibri() {

    const catalogo = document.querySelector(".catalogo");

    const ricerca =
        document.querySelector("#search-filter").value
            .toLowerCase()
            .trim();


    const filtrati = libri.filter(libro => {

        const stato = libro.stato || "collezione";

        const passaFiltro =
            filtro === "all" ||
            (filtro === "in" && stato === "collezione") ||
            (filtro === "vendita" && stato === "vendita") ||
            (filtro === "out" && stato === "ceduto");


        const testo = [
            libro.titolo,
            libro.autore,
            libro.editore,
            libro.collana,
            libro.isbn
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();


        return passaFiltro && testo.includes(ricerca);
    });


    if (!filtrati.length) {

        catalogo.innerHTML = `
            <div class="empty-state">
                <h2>Nessun libro trovato</h2>
                <p>Prova a modificare la ricerca.</p>
            </div>
        `;

        return;
    }


    catalogo.innerHTML = filtrati.map(libro => {

        const stato = libro.stato || "collezione";

        let etichettaStato = "";

        if (stato === "ceduto") {
            etichettaStato =
                `<span class="tag ceduto">Ceduto</span>`;
        }

        if (stato === "vendita") {
            etichettaStato =
                `<span class="tag vendita">In vendita</span>`;
        }


        return `
            <article class="libro">

                <div class="libro-info">

                    <h3>
                        ${libro.titolo || "Senza titolo"}
                    </h3>

                    <p class="autore">
                        ${libro.autore || "Autore non indicato"}
                    </p>

                    <p>
                        ${libro.editore || "Editore non indicato"}
                        ${libro.anno ? " · " + libro.anno : ""}
                    </p>

                    <p>
                        ISBN: ${libro.isbn || "—"}
                    </p>

                    <div class="tags">
                        ${etichettaStato}
                    </div>

                </div>


                <div class="libro-commerciale">

                    ${
                        libro.prezzoAcquisto
                            ? `<span>Acquisto €${parseFloat(libro.prezzoAcquisto).toFixed(2)}</span>`
                            : ""
                    }

                    ${
                        libro.prezzoCessione
                            ? `<span>Cessione €${parseFloat(libro.prezzoCessione).toFixed(2)}</span>`
                            : ""
                    }

                    <button
                        class="scheda-btn"
                        onclick="mostraScheda('${libro.id}')">
                        👁 Scheda
                    </button>

                </div>

            </article>
        `;

    }).join("");
}window.chiudiScheda = function() {
    const overlay = document.querySelector(".scheda-overlay");

    if (overlay) {
        overlay.remove();
    }
};function trovaCopieComparabili(libro) {

    if (!libro.isbn) {
        return [];
    }

    return libri.filter(copia => {

        if (copia.id === libro.id) {
            return false;
        }

        if (copia.isbn !== libro.isbn) {
            return false;
        }

        if ((copia.anno || "") !== (libro.anno || "")) {
            return false;
        }

        if ((copia.editore || "").trim().toLowerCase() !==
            (libro.editore || "").trim().toLowerCase()) {
            return false;
        }

        return true;
    });
}
window.mostraScheda = function(id) {

    const libro = libri.find(libro => libro.id === id);

    if (!libro) {
        return;
    }
    const stato = libro.stato || "collezione";

    const altreCopie = libro.isbn
        ? libri.filter(l =>
            l.id !== libro.id &&
            l.isbn &&
            l.isbn === libro.isbn
        )
        : [];

    const prezzoAcquisto =
        parseFloat(libro.prezzoAcquisto) || 0;

    const prezzoCessione =
        parseFloat(libro.prezzoCessione) || 0;

    const margine =
        prezzoCessione > 0
            ? prezzoCessione - prezzoAcquisto
            : null;

// ===== STORICO COMMERCIALE =====


    const copieComparabili = trovaCopieComparabili(libro);


const venditeComparabili =
    copieComparabili.filter(l =>
        l.stato === "ceduto" &&
        parseFloat(l.prezzoCessione) > 0
    );


const prezziStorici =
    venditeComparabili.map(l =>
        parseFloat(l.prezzoCessione)
    );


// Calcolo della moda
let valoreStorico = null;

if (prezziStorici.length >= 2) {

    const frequenze = {};

    prezziStorici.forEach(prezzo => {

        const chiave = prezzo.toFixed(2);

        frequenze[chiave] =
            (frequenze[chiave] || 0) + 1;

    });


    const massimo = Math.max(
        ...Object.values(frequenze)
    );


    const mode = Object.entries(frequenze)
        .filter(([prezzo, frequenza]) =>
            frequenza === massimo
        )
        .map(([prezzo]) =>
            parseFloat(prezzo)
        );


    // Se c'è una sola moda
    if (mode.length === 1) {
        valoreStorico = mode[0];
    }
}
// Stima manuale inserita dall'utente
const stimaManuale =
    parseFloat(libro.stimaValore) || null;


// Valore da utilizzare come base
const valoreBase =
    valoreStorico !== null
        ? valoreStorico
        : stimaManuale;


// Prezzo suggerito: valore base + 2 euro
const prezzoSuggerito =
    valoreBase !== null
        ? valoreBase + 2
        : null;
let spiegazioneValore = "";

if (valoreStorico !== null) {

    spiegazioneValore = `
        <div class="valore-spiegazione">
            📊 Basato su ${venditeComparabili.length}
            ${venditeComparabili.length === 1 ? "vendita comparabile" : "vendite comparabili"}.
        </div>
    `;

} else if (stimaManuale !== null) {

    spiegazioneValore = `
        <div class="valore-spiegazione">
            ✏️ Valore inserito manualmente.
        </div>
    `;

} else {

    spiegazioneValore = `
        <div class="valore-spiegazione">
            Il valore commerciale non è determinato.
        </div>
    `;
}

        let statoLabel = "In collezione";


    const scheda = document.createElement("div");

    scheda.className = "scheda-overlay";


    scheda.innerHTML = `

        <div class="scheda">

    <button
    class="scheda-chiudi"
    onclick="chiudiScheda()"
    aria-label="Chiudi">
    ×
</button>



            <div class="scheda-header">

                ${
                    libro.cover
                        ? `
                            <div class="scheda-cover">
                                <img
                                    src="${libro.cover}"
                                    alt=""
                                    onerror="this.parentElement.style.display='none'">
                            </div>
                        `
                        : ""
                }

                <div class="scheda-titolo">

                    <div class="scheda-stato">
                        ${statoLabel}
                    </div>

                    <h2>
                        ${libro.titolo || "Senza titolo"}
                    </h2>

                    <p class="scheda-autore">
                        ${libro.autore || "Autore non indicato"}
                    </p>

                    ${
                        libro.isbn
                            ? `<p class="scheda-isbn">ISBN ${libro.isbn}</p>`
                            : ""
                    }

                </div>

            </div>


            ${
                altreCopie.length
                    ? `
                        <div class="avviso-copie">

                            <strong>⚠ Attenzione: stesso ISBN</strong>

                            <span>
                                Nel catalogo esistono altre
                                ${altreCopie.length}
                                ${altreCopie.length === 1 ? "copia" : "copie"}
                                con questo ISBN.
                            </span>

                            <small>
                                L'ISBN non identifica necessariamente
                                questa specifica edizione o variante.
                            </small>

                        </div>
                    `
                    : ""
            }


                        <section>

                <h3>Identificazione bibliografica</h3>

                <div class="form-grid">

                    <div>
                        <strong>ISBN</strong>
                        <span>${libro.isbn || "—"}</span>
                    </div>

                    <div>
                        <strong>Editore</strong>
                        <span>${libro.editore || "—"}</span>
                    </div>

                    <div>
                        <strong>Anno</strong>
                        <span>${libro.anno || "—"}</span>
                    </div>

                    <div>
                        <strong>Edizione</strong>
                        <span>${libro.edizione || "—"}</span>
                    </div>

                    <div>
                        <strong>Ristampa</strong>
                        <span>${libro.ristampa || "—"}</span>
                    </div>

                    <div>
                        <strong>Collana</strong>
                        <span>${libro.collana || "—"}</span>
                    </div>

                    <div>
                        <strong>Lingua</strong>
                        <span>${libro.lingua || "—"}</span>
                    </div>

                </div>

            </section>


            <section>

                <h3>Dati della copia</h3>

                <div class="scheda-grid">

                    <div>
                        <strong>Numero copia</strong>
                        <span>${libro.numeroCopia || "1"}</span>
                    </div>

                    <div>
                        <strong>Copertina</strong>
                        <span>${libro.copertinaRigida || "—"}</span>
                    </div>

                    <div>
                        <strong>Sovracoperta</strong>
                        <span>${libro.sovracoperta || "—"}</span>
                    </div>

                    <div>
                        <strong>Fascia d'età</strong>
                        <span>${libro.fasciaEta || "—"}</span>
                    </div>

                    <div>
                        <strong>Condizioni</strong>
                        <span>${libro.condizioni || "—"}</span>
                    </div>

                </div>


                <div class="scheda-variante">

                    <strong>Caratteristiche / variante della copia</strong>

                    <p>
                        ${
                            libro.variante ||
                            libro.caratteristiche ||
                            libro.note ||
                            "Nessuna caratteristica specifica registrata."
                        }
                    </p>

                </div>

            </section>


            <section>

    <h3>Dati commerciali</h3>

    <div class="scheda-commerciale">

        ${
            valoreStorico !== null
                ? `
                    <div>
                        <strong>📊 Valore storico</strong>
                        <span>
                            €${valoreStorico.toFixed(2)}
                        </span>
                    </div>
                `
                : stimaManuale !== null
                    ? `
                        <div>
                            <strong>✏️ Stima manuale</strong>
                            <span>
                                €${stimaManuale.toFixed(2)}
                            </span>
                        </div>
                    `
                    : `
                        <div>
                            <strong>Valore commerciale</strong>
                            <span>
                                Non determinato
                            </span>
                        </div>
                    `
        }

        ${spiegazioneValore}

        ${
            prezzoSuggerito !== null
                ? `
                    <div class="prezzo-suggerito">
                        <strong>💰 Prezzo suggerito</strong>
                        <span>
                            €${prezzoSuggerito.toFixed(2)}
                        </span>
                    </div>
                `
                : ""
        }

        <div>
            <strong>Prezzo di acquisto</strong>
            <span>
                ${
                    prezzoAcquisto
                        ? "€" + prezzoAcquisto.toFixed(2)
                        : "—"
                }
            </span>
        </div>

        <div>
            <strong>Stato</strong>
            <span>${statoLabel}</span>
        </div>

        <div>
            <strong>Prezzo di cessione</strong>
            <span>
                ${
                    prezzoCessione
                        ? "€" + prezzoCessione.toFixed(2)
                        : "—"
                }
            </span>
        </div>

        ${
            margine !== null
                ? `
                    <div class="margine">
                        <strong>Margine lordo</strong>
                        <span>
                            €${margine.toFixed(2)}
                        </span>
                    </div>
                `
                : ""
        }

    </div>

</section>


            <section>

                <h3>Movimenti</h3>

                <div class="scheda-grid">

                    <div>
                        <strong>Data inserimento</strong>
                        <span>
                            ${
                                libro.creato
                                    ? new Date(libro.creato)
                                        .toLocaleDateString("it-IT")
                                    : "—"
                            }
                        </span>
                    </div>

                    <div>
                        <strong>Data cessione</strong>
                        <span>
                            ${libro.dataCessione || "—"}
                        </span>
                    </div>

                    <div>
                        <strong>Canale di vendita</strong>
                        <span>
                            ${libro.canaleCessione || "—"}
                        </span>
                    </div>

                </div>

            </section>


            <section>

                <h3>Note</h3>

                <div class="scheda-note">

                    ${
                        libro.note
                            ? libro.note
                            : "Nessuna nota."
                    }

                </div>

            </section>


            <div class="scheda-actions">

                <button
                    class="scheda-modifica"
                    onclick="modificaLibro('${libro.id}')">
                    ✏️ Modifica copia
                </button>

                <button
                    class="scheda-chiudi-btn"
                    onclick="chiudiScheda()">
                    Chiudi
                </button>

            </div>


            <div class="scheda-id">
                ID copia: ${libro.id}
            </div>

        </div>
    `;


    document.body.appendChild(scheda);
};

window.modificaLibro = function(id) {

    const libro = libri.find(libro => libro.id === id);

    if (!libro) {
        return;
    }


    const overlay = document.createElement("div");

    overlay.className = "scheda-overlay";

    // TASK 6 - controlla se esistono discrepanze bibliografiche
    // tra copie con lo stesso ISBN

    const campiEdizione = [
        "editore",
        "anno",
        "edizione",
        "ristampa",
        "collana"
    ];

    const copieStessoISBN = libri.filter(l =>
        l.id !== libro.id &&
        (l.isbn || "").trim() === (libro.isbn || "").trim() &&
        (libro.isbn || "").trim() !== ""
    );

    const haDiscrepanzeEdizione = copieStessoISBN.some(copia =>
        campiEdizione.some(campo => {
            const valoreCorrente = String(libro[campo] || "").trim();
            const valoreAltraCopia = String(copia[campo] || "").trim();

            return valoreCorrente !== valoreAltraCopia;
        })
    );
    overlay.innerHTML = `

        <div class="scheda">

            <button
                class="scheda-chiudi"
                onclick="this.closest('.scheda-overlay').remove()">
                ×
            </button>


            <h2>Modifica copia</h2>

            <p class="scheda-autore">
                ${libro.titolo || "Senza titolo"}
                ${libro.autore ? " · " + libro.autore : ""}
            </p>


                        <section>

               <h3>Identificazione bibliografica</h3>

${
    haDiscrepanzeEdizione
        ? `
            <div style="margin-bottom: 16px;">
                <button
                    type="button"
                    class="scheda-modifica"
                    onclick="verificaEdizione('${libro.id}')">
                    🔎 Verifica edizione
                </button>
            </div>

            <div id="verifica-edizione-risultato"></div>
        `
        : copieStessoISBN.length > 0
            ? `
                <div style="margin-bottom: 16px;">
                    <small>
                        ✓ Edizione coerente con
                        ${copieStessoISBN.length}
                        ${copieStessoISBN.length === 1
                            ? "altra copia"
                            : "altre copie"}.
                    </small>
                </div>
            `
            : ""
}

<div class="form-grid">

                    <label>
                        Titolo
                        <input
                            id="edit-titolo"
                            value="${libro.titolo || ""}">
                    </label>

                    <label>
                        Autore
                        <input
                            id="edit-autore"
                            value="${libro.autore || ""}">
                    </label>

                    <label>
                        ISBN
                        <input
                            id="edit-isbn"
                            value="${libro.isbn || ""}">
                    </label>

                    <label>
                        Editore
                        <input
                            id="edit-editore"
                            value="${libro.editore || ""}">
                    </label>

                    <label>
                        Anno
                        <input
                            id="edit-anno"
                            value="${libro.anno || ""}">
                    </label>

                    <label>
                        Edizione
                        <input
                            id="edit-edizione"
                            value="${libro.edizione || ""}">
                    </label>

                    <label>
                        Ristampa
                        <input
                            id="edit-ristampa"
                            value="${libro.ristampa || ""}">
                    </label>

                    <label>
                        Collana
                        <input
                            id="edit-collana"
                            value="${libro.collana || ""}">
                    </label>

                    <label>
                        Lingua
                        <input
                            id="edit-lingua"
                            value="${libro.lingua || ""}">
                    </label>

                </div>

            </section>


            <section>

                <h3>Dati della copia</h3>

                <div class="form-grid">

                    <label>
                        Numero copia
                        <input
                            type="number"
                            min="1"
                            id="edit-numeroCopia"
                            value="${libro.numeroCopia || 1}">
                    </label>

                    <label>
                        Copertina
                        <input
                            id="edit-copertina"
                            value="${libro.copertinaRigida || ""}">
                    </label>

                    <label>
                        Sovracoperta
                        <input
                            id="edit-sovracoperta"
                            value="${libro.sovracoperta || ""}">
                    </label>

                    <label>
                        Fascia d'età
                        <input
                            id="edit-fasciaEta"
                            value="${libro.fasciaEta || ""}">
                    </label>

                    <label>
                        Condizioni
                        <input
                            id="edit-condizioni"
                            value="${libro.condizioni || ""}">
                    </label>

                </div>


                <label class="form-full">
                    Caratteristiche / variante della copia

                    <textarea
                        id="edit-variante"
                        rows="4"
                        placeholder="Elementi che distinguono questa copia dalle altre...">${libro.variante || libro.caratteristiche || ""}</textarea>

                </label>
                <label>
    Stima del valore commerciale (€)

    <input
        type="number"
        id="edit-stimaValore"
        min="0"
        step="0.50"
        value="${libro.stimaValore || ""}"
        placeholder="Lascia vuoto se non vuoi stimare">
</label>


                <label class="form-full">
                    Note

                    <textarea
                        id="edit-note"
                        rows="4">${libro.note || ""}</textarea>

                </label>

            </section>


            <section>

                <h3>Dati commerciali</h3>

                <div class="form-grid">

                    <label>
                        Prezzo acquisto (€)

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            id="edit-prezzoAcquisto"
                            value="${libro.prezzoAcquisto || ""}">
                    </label>


                    <label>
                        Stato

                        <select id="edit-stato">

                            <option
                                value="collezione"
                                ${libro.stato === "collezione" ? "selected" : ""}>
                                In collezione
                            </option>

                            <option
                                value="vendita"
                                ${libro.stato === "vendita" ? "selected" : ""}>
                                In vendita
                            </option>

                            <option
                                value="ceduto"
                                ${libro.stato === "ceduto" ? "selected" : ""}>
                                Ceduto
                            </option>

                        </select>

                    </label>


                    <label>
                        Prezzo cessione (€)

                        <input
                            type="number"
                            min="0"
                            step="0.01"
                            id="edit-prezzoCessione"
                            value="${libro.prezzoCessione || ""}">
                    </label>


                    <label>
                        Data cessione

                        <input
                            type="date"
                            id="edit-dataCessione"
                            value="${libro.dataCessione || ""}">
                    </label>


                    <label>
                        Canale di vendita

                        <input
                            id="edit-canaleCessione"
                            value="${libro.canaleCessione || ""}">
                    </label>

                </div>

            </section>


            <div class="scheda-actions">

                <button
                    class="scheda-chiudi-btn"
                    onclick="this.closest('.scheda-overlay').remove()">
                    Annulla
                </button>

                <button
                    class="scheda-modifica"
                    onclick="salvaModificaLibro('${libro.id}')">
                    💾 Salva modifiche
                </button>

            </div>

        </div>
    `;


    document.body.appendChild(overlay);
};
window.verificaEdizione = function(id) {

    const libro = libri.find(l => l.id === id);
    if (!libro) return;

    const isbn = (
        document.querySelector("#edit-isbn")?.value ||
        libro.isbn ||
        ""
    ).trim();

    const risultato =
        document.querySelector("#verifica-edizione-risultato");

    if (!isbn) {
        risultato.innerHTML = `
            <div class="avviso-copie">
                <strong>ISBN non presente</strong>
                <span>
                    Non è possibile verificare l'edizione senza un ISBN.
                </span>
            </div>
        `;
        return;
    }

    const copieStessoISBN = libri.filter(l =>
        l.id !== id &&
        (l.isbn || "").trim() === isbn
    );

    if (!copieStessoISBN.length) {
        risultato.innerHTML = `
            <div class="avviso-copie">
                <strong>✓ Nessun'altra copia trovata</strong>
                <span>
                    Nel catalogo non risultano altre copie
                    con ISBN ${isbn}.
                </span>
            </div>
        `;
        return;
    }

    const tutteLeCopie = [libro, ...copieStessoISBN];

    function raccogliValori(campo) {

        const conteggio = new Map();
        let mancanti = 0;

        tutteLeCopie.forEach(copia => {

            const valore = String(copia[campo] || "").trim();

            if (!valore) {
                mancanti++;
                return;
            }

            const esistente = conteggio.get(valore) || 0;
            conteggio.set(valore, esistente + 1);
        });

        return {
            valori: [...conteggio.entries()]
                .sort((a, b) => b[1] - a[1]),
            mancanti
        };
    }

    function mostraCampo(etichetta, campo) {

        const dati = raccogliValori(campo);

        let html = `
            <div style="margin-top: 16px;">
                <strong>${etichetta}</strong>
        `;

        if (dati.valori.length) {

            html += `
                <div style="margin-top: 6px;">
            `;

            dati.valori.forEach(([valore, numero]) => {

                html += `
                    <label style="
                        display:block;
                        margin:6px 0;
                        cursor:pointer;
                    ">
                        <input
                            type="radio"
                            name="verifica-${campo}"
                            value="${encodeURIComponent(valore)}">

                        ${valore}

                        <small>
                            (${numero}
                            ${numero === 1 ? "copia" : "copie"})
                        </small>
                    </label>
                `;
            });

            html += `</div>`;
        }

        if (dati.mancanti > 0) {
            html += `
                <div style="
                    margin-top:5px;
                    font-size:0.9em;
                    opacity:0.75;
                ">
                    ${dati.mancanti}
                    ${dati.mancanti === 1
                        ? "copia senza indicazione"
                        : "copie senza indicazione"}
                </div>
            `;
        }

        html += `</div>`;

        return html;
    }

    risultato.innerHTML = `
        <div class="avviso-copie">

            <strong>🔎 Verifica edizione</strong>

            <span>
                Nel catalogo risultano
                ${copieStessoISBN.length}
                ${copieStessoISBN.length === 1
                    ? "altra copia"
                    : "altre copie"}
                con ISBN ${isbn}.
            </span>

            ${mostraCampo("Editore", "editore")}
            ${mostraCampo("Anno", "anno")}
            ${mostraCampo("Edizione", "edizione")}
            ${mostraCampo("Ristampa", "ristampa")}
            ${mostraCampo("Collana", "collana")}

            <div style="margin-top:18px;">
                <button
                    type="button"
                    class="scheda-modifica"
                    onclick="applicaDatiEdizione()">
                    ✓ Applica alla copia corrente
                </button>
            </div>

            <small style="display:block; margin-top:10px;">
                I valori selezionati verranno riportati nel modulo.
                Il database non sarà modificato finché non premi
                "Salva modifiche".
            </small>

        </div>
    `;
};window.applicaDatiEdizione = function() {

    const associazioni = [
        ["editore", "edit-editore"],
        ["anno", "edit-anno"],
        ["edizione", "edit-edizione"],
        ["ristampa", "edit-ristampa"],
        ["collana", "edit-collana"]
    ];

    let modifiche = 0;
    const datiSelezionati = {};

    associazioni.forEach(([campo, idInput]) => {

        const radio = document.querySelector(
            `input[name="verifica-${campo}"]:checked`
        );

        if (!radio) return;

        const input = document.getElementById(idInput);

        if (!input) {
            console.warn(`Campo non trovato: ${idInput}`);
            return;
        }

        const valore = decodeURIComponent(radio.value);

        input.value = valore;
        datiSelezionati[campo] = valore;

        modifiche++;
    });

    if (modifiche === 0) {
        alert("Seleziona almeno un dato bibliografico da applicare.");
        return;
    }

    // Memorizza temporaneamente i dati scelti.
    // NON modifica ancora le altre copie.
    window.datiEdizioneDaUniformare = datiSelezionati;

    const risultato = document.getElementById(
        "verifica-edizione-risultato"
    );

    if (risultato) {

        let areaUniforma = document.getElementById(
            "uniforma-edizione-area"
        );

        if (!areaUniforma) {
            areaUniforma = document.createElement("div");
            areaUniforma.id = "uniforma-edizione-area";
            areaUniforma.style.marginTop = "18px";

            risultato.appendChild(areaUniforma);
        }

        areaUniforma.innerHTML = `
            <div class="avviso-copie">

                <strong>🔄 Uniforma tutte le copie</strong>

                <span>
                    I dati bibliografici selezionati possono essere
                    applicati anche alle altre copie con lo stesso ISBN.
                </span>

                <div style="margin-top:12px;">
                    <button
                        type="button"
                        class="scheda-modifica"
                        onclick="anteprimaUniformazioneEdizione()">
                        🔄 Uniforma tutte le copie
                    </button>
                </div>

                <small style="display:block; margin-top:10px;">
                    Prima della modifica verrà mostrato un riepilogo.
                    Nessun'altra copia viene modificata in questa fase.
                </small>

            </div>
        `;
    }

    alert(
        `${modifiche} ${
            modifiche === 1 ? "dato aggiornato" : "dati aggiornati"
        } nel modulo.\n\nControllali e poi premi Salva modifiche.`
    );
};
window.anteprimaUniformazioneEdizione = async function() {

    const dati = window.datiEdizioneDaUniformare;

    if (!dati || Object.keys(dati).length === 0) {
        alert("Non ci sono dati bibliografici selezionati da uniformare.");
        return;
    }

    const isbnInput = document.querySelector("#edit-isbn");

    if (!isbnInput) {
        alert("ISBN della copia corrente non trovato.");
        return;
    }

    const isbn = isbnInput.value.trim();

    if (!isbn) {
        alert("Non è possibile uniformare le copie senza ISBN.");
        return;
    }

    const copieDaUniformare = libri.filter(libro =>
        (libro.isbn || "").trim() === isbn
    );

    if (copieDaUniformare.length < 2) {
        alert("Non risultano altre copie con questo ISBN.");
        return;
    }

    const nomiCampi = {
        editore: "Editore",
        anno: "Anno",
        edizione: "Edizione",
        ristampa: "Ristampa",
        collana: "Collana"
    };

    let riepilogo = `UNIFORMA EDIZIONE\n\n`;
    riepilogo += `ISBN: ${isbn}\n`;
    riepilogo += `Copie interessate: ${copieDaUniformare.length}\n\n`;

    Object.entries(dati).forEach(([campo, valore]) => {
        riepilogo += `${nomiCampi[campo] || campo}: ${valore || "—"}\n`;
    });

    riepilogo +=
        `\nVerranno modificati esclusivamente i dati bibliografici indicati.` +
        `\nTutti gli altri dati delle singole copie resteranno invariati.` +
        `\n\nProcedere con l'uniformazione?`;

    const conferma = confirm(riepilogo);

    if (!conferma) {
        return;
    }

    try {

        for (const copia of copieDaUniformare) {

            await updateDoc(
                doc(db, "libri", copia.id),
                dati
            );

            const indice = libri.findIndex(
                libro => libro.id === copia.id
            );

            if (indice !== -1) {
                libri[indice] = {
                    ...libri[indice],
                    ...dati
                };
            }
        }

        aggiornaStatistiche();
        mostraLibri();

        window.datiEdizioneDaUniformare = null;

        alert(
            `${copieDaUniformare.length} copie uniformate correttamente.`
        );

        document
            .querySelector(".scheda-overlay")
            ?.remove();

    } catch (errore) {

        console.error(
            "Errore durante l'uniformazione dell'edizione:",
            errore
        );

        alert(
            "Si è verificato un errore durante l'uniformazione. " +
            "Controlla i dati prima di riprovare."
        );
    }
};

function controllaCoerenzaEdizioni() {

    const campi = [
        "editore",
        "anno",
        "edizione",
        "ristampa",
        "collana"
    ];

    const gruppiISBN = new Map();

    libri.forEach(libro => {
        const isbn = String(libro.isbn || "").trim();

        if (!isbn) return;

        if (!gruppiISBN.has(isbn)) {
            gruppiISBN.set(isbn, []);
        }

        gruppiISBN.get(isbn).push(libro);
    });

    const anomalie = [];

    gruppiISBN.forEach((copie, isbn) => {

        if (copie.length < 2) return;

        const discrepanze = [];

        campi.forEach(campo => {

            const valori = copie.map(copia =>
                String(copia[campo] || "").trim()
            );

            const valoriPresenti = [
                ...new Set(valori.filter(Boolean))
            ];

            const ciSonoVuoti = valori.some(v => !v);

            if (valoriPresenti.length > 1) {
                discrepanze.push({
                    campo,
                    tipo: "discordante",
                    valori: valoriPresenti
                });
            } else if (
                valoriPresenti.length === 1 &&
                ciSonoVuoti
            ) {
                discrepanze.push({
                    campo,
                    tipo: "incompleto",
                    valori: valoriPresenti
                });
            }
        });

        if (discrepanze.length > 0) {
            anomalie.push({
                isbn,
                titolo: copie[0].titolo || "Senza titolo",
                numeroCopie: copie.length,
                idCopie: copie.map(copia => copia.id),
                discrepanze
            });
        }
    });

    return anomalie;
}
window.controllaCoerenzaEdizioni = controllaCoerenzaEdizioni;

// TASK 6C.2 — Pannello diagnostico, in sola lettura.
function mostraControlloCoerenza() {
    document.querySelector("#pannello-coerenza")?.remove();

    const anomalie = controllaCoerenzaEdizioni();
    const escapeHTML = valore => String(valore ?? "").replace(/[&<>"']/g, carattere => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[carattere]);

    const overlay = document.createElement("div");
    overlay.id = "pannello-coerenza";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Controllo coerenza edizioni");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10000;overflow:auto;padding:24px 12px;box-sizing:border-box";

    const righe = anomalie.map(anomalia => `
        <article style="border:1px solid #ddd;border-radius:10px;padding:14px;margin:12px 0">
            <strong>${escapeHTML(anomalia.titolo)}</strong>
            <div style="font-size:.9em;margin:6px 0">ISBN: ${escapeHTML(anomalia.isbn)} · ${anomalia.numeroCopie} copie</div>
            <ul style="padding-left:20px;margin:8px 0">
                ${anomalia.discrepanze.map(d => `<li><strong>${escapeHTML(d.campo)}</strong> — ${d.tipo === "discordante" ? "Valori discordanti" : "Dati incompleti"}: ${escapeHTML(d.valori.join(" / "))}${d.tipo === "incompleto" ? " (altre copie senza dato)" : ""}</li>`).join("")}
            </ul>
            <button type="button" class="verifica-anomalia" data-id="${escapeHTML(anomalia.idCopie[0])}" style="margin-top:8px;padding:9px 14px;cursor:pointer">🔎 Verifica edizione</button>
        </article>
    `).join("");

    overlay.innerHTML = `
        <div style="max-width:760px;margin:0 auto;background:white;color:#222;border-radius:14px;padding:20px;box-sizing:border-box">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px">
                <h2 style="margin:0">🔎 Controllo coerenza edizioni</h2>
                <button type="button" id="chiudi-controllo-coerenza" aria-label="Chiudi controllo">✕ Chiudi</button>
            </div>
            <p>${anomalie.length} ISBN con anomalie. Analisi in sola lettura: nessun dato viene modificato.</p>
            ${righe || "<p>✓ Nessuna discrepanza rilevata tra le copie con lo stesso ISBN.</p>"}
        </div>
    `;

    document.body.appendChild(overlay);
    // TASK 6C.3: riutilizza la modifica e la verifica del Task 6B.
    overlay.querySelectorAll(".verifica-anomalia").forEach(pulsante => {
        pulsante.addEventListener("click", () => {
            const id = pulsante.dataset.id;
            overlay.remove();
            window.modificaLibro(id);
            window.verificaEdizione(id);
        });
    });
    overlay.querySelector("#chiudi-controllo-coerenza").addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", evento => {
        if (evento.target === overlay) overlay.remove();
    });
}

// Il pulsante è esterno ai filtri del catalogo.
document.querySelector("#btn-controllo-coerenza")?.addEventListener("click", mostraControlloCoerenza);

window.salvaModificaLibro = async function(id) {

    const dati = {

        titolo: document.querySelector("#edit-titolo").value.trim(),

        autore: document.querySelector("#edit-autore").value.trim(),

        isbn: document.querySelector("#edit-isbn").value.trim(),

        editore: document.querySelector("#edit-editore").value.trim(),

        anno: document.querySelector("#edit-anno").value.trim(),

        edizione: document.querySelector("#edit-edizione").value.trim(),

        ristampa: document.querySelector("#edit-ristampa").value.trim(),

        collana: document.querySelector("#edit-collana").value.trim(),

        lingua: document.querySelector("#edit-lingua").value.trim(),

        numeroCopia:
            parseInt(
                document.querySelector("#edit-numeroCopia").value
            ) || 1,

        copertinaRigida:
            document.querySelector("#edit-copertina").value.trim(),

        sovracoperta:
            document.querySelector("#edit-sovracoperta").value.trim(),

        fasciaEta:
            document.querySelector("#edit-fasciaEta").value.trim(),

        condizioni:
            document.querySelector("#edit-condizioni").value.trim(),

        variante:
            document.querySelector("#edit-variante").value.trim(),
            stimaValore:
    parseFloat(
        document.querySelector("#edit-stimaValore").value
    ) || null,

        note:
            document.querySelector("#edit-note").value.trim(),

        prezzoAcquisto:
            document.querySelector("#edit-prezzoAcquisto").value,

        stato:
            document.querySelector("#edit-stato").value,

        prezzoCessione:
            document.querySelector("#edit-prezzoCessione").value,

        dataCessione:
            document.querySelector("#edit-dataCessione").value,

        canaleCessione:
            document.querySelector("#edit-canaleCessione").value.trim()
    };


    try {

        await updateDoc(
            doc(db, "libri", id),
            dati
        );


        const indice = libri.findIndex(
            libro => libro.id === id
        );


        if (indice !== -1) {

            libri[indice] = {
                ...libri[indice],
                ...dati
            };

        }


        document
            .querySelector(".scheda-overlay")
            .remove();


        aggiornaStatistiche();

        mostraLibri();


        mostraScheda(id);


        console.log(
            "Copia aggiornata:",
            id
        );


    } catch (errore) {

        console.error(
            "Errore nel salvataggio:",
            errore
        );

        alert(
            "Non è stato possibile salvare le modifiche."
        );
    }
};
document
    .querySelector("#search-filter")
    .addEventListener("input", mostraLibri);


document
    .querySelectorAll(".filter-btn")
    .forEach(pulsante => {

        pulsante.addEventListener("click", () => {

            document
                .querySelectorAll(".filter-btn")
                .forEach(b =>
                    b.classList.remove("active")
                );

            pulsante.classList.add("active");

            filtro = pulsante.dataset.filter;

            mostraLibri();
        });

    });


caricaLibri();