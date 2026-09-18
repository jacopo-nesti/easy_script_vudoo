# Architettura di Sistema

Questo documento descrive l'architettura dei componenti e il ruolo dei singoli file e moduli all'interno del progetto **easy_script_vudoo**.

---

## 1. Panoramica della Struttura
Il progetto adotta un'architettura modulare, separando gli script di orchestrazione e interfaccia situati nella root principale dai moduli di business collocati all'interno della cartella `src/`.

---

## 2. Moduli alla Radice
*   **`index.js`**: Punto d'ingresso principale dell'applicazione. Si occupa di coordinare l'avvio dei flussi di lavoro principali.
*   **`cli.js`**: Gestisce l'interfaccia a riga di comando (CLI), interpretando i parametri passati dall'utente e smistandoli verso le operazioni appropriate.
*   **`sync.js`**: Modulo responsabile della sincronizzazione complessiva dei dati tra le sorgenti esterne e i sistemi di destinazione.
*   **`convert_xml_to_json.js`**: Script di utilità dedicato alla conversione di feed o file XML in formato JSON, standardizzando i dati per le fasi successive.
*   **`productor.js`**: Script orientato alla gestione e alla manipolazione centralizzata dei prodotti a livello di root.

---

## 3. Moduli nella cartella `src/`
*   **`src/baseApi.js`**: Client HTTP fondamentale che incapsula la comunicazione con le API esterne, gestendo autenticazione, endpoint di base, header e gestione centralizzata degli errori di rete.
*   **`src/products.js`**: Modulo specializzato nella gestione delle entità *prodotto* (creazione, aggiornamento, recupero e mappatura dei dati).
*   **`src/categories.js`**: Modulo dedicato alla gestione e sincronizzazione delle categorie merceologiche.
*   **`src/manufacturers.js`**: Modulo che gestisce i produttori e i brand dei prodotti sincronizzati.
*   **`src/productor.js`**: Componente di supporto per la logica di business e la formattazione dei dati legati ai prodotti all'interno del layer di servizio.
*   **`src/operations.js`**: Orchestratore delle operazioni di business ad alto livello, che combina più chiamate e logiche sequenziali in flussi complessi.

---

## 4. Note di Compatibilità e Sviluppo

> **Nota su `update-inventory.js`**: Il file `update-inventory.js` è attualmente mantenuto come **wrapper di compatibilità** per preservare il supporto a flussi legacy. Tale componente verrà analizzato e gestito all'interno di una *Issue di cleanup* separata per definirne la completa rimozione o modernizzazione.