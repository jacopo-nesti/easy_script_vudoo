# Modalità della CLI e Comandi Disponibili

Questo documento descrive le modalità di esecuzione e i comandi disponibili per la gestione, la sincronizzazione e il testing del progetto **Vudoo Base Connector**.

---

## 1. Menu Principale

### `npm start`

Apre la CLI interattiva con le seguenti opzioni:

0. Verifica ambiente e configurazione;
1. Converti XML → JSON;
2. Esegui controlli preliminari;
3. Sincronizza produttori;
4. Importa o aggiorna prodotti;
5. Esegui il flusso completo;
6. Esegui i test automatici;
7. Esci.

La CLI mostra lo stato corrente di `DRY_RUN` e `TEST_MODE` senza modificare automaticamente il file `.env`.

---

## 2. Verifica configurazione

### `npm run check`

Controlla ambiente, configurazione e collegamento read-only alle risorse Base.com necessarie.

---

## 3. Importazione Diretta

### `npm run import`

Esegue direttamente il preflight e l'importazione/aggiornamento dei prodotti verso Base.com.

---

## 4. Conversione

### `npm run convert`

Converte il file locale `VUDOO.xml` in `real_products.json`.

---

## 5. Produttori

### `npm run productor`

Esegue la sincronizzazione separata dei produttori. Il comando non fa parte del sync completo perché l'importazione gestisce già i produttori mancanti.

---

## 6. Flusso Completo

### `npm run sync`

Esegue in sequenza:

```text
XML → JSON → preflight → importazione Base.com
```

Il flusso si interrompe se conversione, preflight o importazione falliscono.

---

## 7. Test

### `npm test`

Esegue la suite automatica configurata nel progetto. La suite corrente comprende **110 test**.

Prima di verifiche manuali verso Base.com è consigliato mantenere `DRY_RUN=true`; per smoke test read-only è disponibile anche `tests/read-only-base.mjs`.
