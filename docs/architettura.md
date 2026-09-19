# Architettura di Sistema

Questo documento descrive l'architettura dei componenti e il ruolo dei singoli file e moduli all'interno del progetto **easy_script_vudoo**.

---

## 1. Panoramica della Struttura

Il progetto adotta un'architettura modulare, separando gli entry point e l'interfaccia nella root dai moduli condivisi nella cartella `src/`.

Il flusso usa un file XML locale come sorgente, genera `real_products.json` e sincronizza i dati verso Base.com dopo preflight, normalizzazione e confronto.

---

## 2. Moduli alla Radice

* **`cli.js`**: menu interattivo principale;
* **`index.js`**: orchestrazione dell'importazione e dell'aggiornamento prodotti;
* **`sync.js`**: entry point del flusso completo non interattivo;
* **`check.js`**: diagnostica dell'ambiente e della configurazione;
* **`convert_xml_to_json.js`**: wrapper della conversione XML → JSON;
* **`productor.js`**: wrapper della sincronizzazione separata dei produttori.

---

## 3. Moduli nella cartella `src/`

* **`src/baseApi.js`**: comunicazione con Base.com, selezione delle risorse, ricerca SKU, CREATE/UPDATE, rate limiting, retry delle letture e verifica delle scritture incerte;
* **`src/products.js`**: lettura prodotti, normalizzazione, validazione, deduplicazione e costruzione dei payload;
* **`src/preflight.js`**: controlli preliminari su configurazione, dati e risorse Base.com;
* **`src/categories.js`**: recupero, associazione e creazione controllata delle categorie;
* **`src/manufacturers.js`**: recupero, associazione e creazione controllata dei produttori;
* **`src/productor.js`**: sincronizzazione separata dei produttori usando la logica condivisa;
* **`src/converter.js`**: parsing di `VUDOO.xml` e generazione di `real_products.json`;
* **`src/operations.js`**: orchestrazione delle operazioni richiamate da CLI e sync;
* **`src/checker.js`**: controlli diagnostici;
* **`src/config.js`** e **`src/logger.js`**: configurazione e log condivisi.

---

## 4. Sicurezza e test

Le scritture passano dal gate centralizzato `DRY_RUN` in `src/baseApi.js`. Le letture temporaneamente fallite possono essere ritentate; le scritture con esito incerto vengono verificate senza retry ciechi.

La suite è contenuta in `tests/integration-review.test.js` e `tests/cli.test.js`. Il file `tests/read-only-base.mjs` offre una guardia aggiuntiva per smoke test manuali read-only.
