# Release Notes — v1.1.0

Data: 16 settembre 2026

La versione `v1.1.0` rende il flusso Vudoo → Base.com più sicuro, verificabile e semplice da utilizzare.

## Novità principali

### CLI interattiva

Il comando:

`npm start`

apre ora un menu interattivo con le principali operazioni:

1. Converti XML → JSON
2. Sincronizza produttori
3. Importa / aggiorna prodotti su Base.com
4. Esegui flusso completo
5. Esegui test automatici
6. Esci

Restano disponibili anche i comandi tecnici:

- `npm run import`
- `npm run convert`
- `npm run productor`
- `npm run sync`
- `npm test`

### Flusso completo

È stato aggiunto:

`npm run sync`

Il comando esegue:

XML → JSON → importazione Base.com

Se la conversione fallisce, l'importazione non viene avviata.

Il comando `productor` resta separato perché l'importazione gestisce già automaticamente i produttori mancanti.

---

## Aggiornamento prodotti

La sincronizzazione dei prodotti esistenti è stata resa selettiva.

Il sistema:

- cerca il prodotto tramite SKU;
- recupera i dati presenti su Base.com;
- confronta soltanto i campi gestiti;
- aggiorna esclusivamente i valori realmente modificati;
- salta i prodotti già allineati.

Questo permette di distinguere chiaramente:

- CREATE
- UPDATE
- SKIP

Gli SKU ambigui su Base.com vengono bloccati invece di scegliere arbitrariamente un prodotto.

---

## SKU duplicati

È stata integrata la gestione dei duplicati presenti nel feed.

Duplicati equivalenti vengono deduplicati.

Duplicati con informazioni rilevanti differenti vengono segnalati come conflitti.

Nel feed utilizzato per la verifica finale:

- 128 record letti
- 114 SKU unici
- 14 occorrenze duplicate saltate

---

## Categorie e produttori

La gestione di categorie e produttori è stata centralizzata.

Le categorie vengono identificate anche tramite la gerarchia e il `parent_id`.

I produttori vengono normalizzati per evitare duplicati dovuti a differenze di maiuscole, minuscole o spazi.

Le mappe locali vengono aggiornate dopo eventuali creazioni.

---

## Prezzi

È stato corretto il parsing dei prezzi con separatori delle migliaia.

Esempi supportati:

- `25,00 EUR`
- `999,00 EUR`
- `1.098,00 EUR`
- `4.880,00 EUR`
- `1.234.567,89 EUR`

I formati ambigui vengono rifiutati.

---

## DRY_RUN

Le scritture verso Base.com sono protette centralmente.

Con:

`DRY_RUN=true`

non vengono effettuate scritture di:

- prodotti
- categorie
- produttori

`.env.example` utilizza ora `DRY_RUN=true` come configurazione predefinita sicura.

---

## Sanitizzazione Unicode

Durante le verifiche reali è stato individuato un problema causato da emoji e caratteri Unicode non supportati correttamente da Base.com.

Alcuni caratteri venivano salvati come `?`, provocando UPDATE ripetuti a ogni sincronizzazione.

È stata introdotta:

`sanitizeTextForBase()`

La funzione elimina dai testi destinati a Base.com i caratteri Unicode non-BMP incompatibili, preservando caratteri supportati come:

- accenti
- apostrofi tipografici
- `–`
- `€`
- `✨`

La sanitizzazione viene utilizzata sia per CREATE sia per UPDATE.

Il file XML sorgente non viene modificato.

---

## Test automatici

La suite automatica contiene:

**53 test**

Risultato finale:

- 53 passati
- 0 falliti

La suite copre anche:

- CLI
- sync
- CREATE / UPDATE / SKIP
- DRY_RUN
- parsing prezzi
- categorie
- produttori
- SKU duplicati e ambigui
- inventory
- warehouse
- errori API
- sanitizzazione Unicode
- idempotenza degli UPDATE

---

## Verifica reale finale

Dopo l'allineamento del catalogo è stata eseguita una nuova importazione completa.

Risultato:

- Prodotti letti: 128
- Prodotti selezionati: 114
- Prodotti processati: 114
- Creati: 0
- Aggiornati: 0
- Invariati: 114
- Duplicati nel feed saltati: 14
- Simulati: 0
- Errori: 0

La sincronizzazione è risultata idempotente sul feed testato.

---

## Limitazioni note

Durante le verifiche intensive è stato raggiunto il rate limit delle API Base.com:

`ERROR_BLOCKED_TOKEN - Query limit exceeded`

La relativa Issue resta aperta con priorità alta.

La versione `v1.1.0` non include ancora una gestione automatica completa di:

- throttling
- retry
- backoff
- esiti incerti delle scritture

Restano inoltre pianificati:

- connessione diretta alle API Vudoo
- sincronizzazione stock completa
- gestione avanzata delle immagini
- miglioramento dei log
- cleanup del codice legacy
- aggiornamento ulteriore della documentazione