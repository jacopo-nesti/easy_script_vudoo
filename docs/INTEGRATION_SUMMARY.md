# Integration Summary

Data: 16 settembre 2026

Questo documento riassume le principali modifiche integrate nel progetto fino alla preparazione della release `v1.1.0`.

L'obiettivo del lavoro è stato consolidare le modifiche provenienti da diversi branch, correggere i problemi individuati durante i test reali e rendere il flusso Vudoo → Base.com più sicuro, verificabile e semplice da utilizzare, senza sostituire completamente la base stabile del progetto.

---

## 1. Architettura

È stata mantenuta l'architettura modulare introdotta con il refactor.

Responsabilità principali:

- `index.js`
  - orchestrazione del flusso di importazione;

- `src/baseApi.js`
  - comunicazione con Base.com;
  - ricerca prodotti;
  - recupero dettagli;
  - CREATE / UPDATE;
  - protezioni API;

- `src/products.js`
  - normalizzazione;
  - validazione;
  - parsing valori;
  - payload prodotti;
  - confronto prodotti;
  - gestione SKU duplicati;
  - sanitizzazione dei testi destinati a Base.com;

- `src/categories.js`
  - recupero e creazione categorie;
  - gestione gerarchia categorie;

- `src/manufacturers.js`
  - recupero e creazione produttori;
  - normalizzazione nomi;

- `src/productor.js`
  - sincronizzazione produttori tramite la logica condivisa;

- `src/operations.js`
  - orchestrazione condivisa dei comandi utilizzati dalla CLI e dal sync;

- `cli.js`
  - menu interattivo principale;

- `sync.js`
  - entry point per il flusso completo non interattivo.

`update-inventory.js` non contiene più la logica principale di UPDATE.

È rimasto come wrapper di compatibilità verso le nuove funzioni presenti nei moduli `src`.

---

## 2. Aggiornamento prodotti esistenti

La logica UPDATE è stata consolidata.

Il sistema:

1. cerca il prodotto tramite SKU;
2. recupera i dati presenti su Base.com;
3. confronta i dati con quelli provenienti dal feed;
4. determina quali valori sono realmente cambiati;
5. invia soltanto i campi modificati.

Non viene più inviato inutilmente l'intero prodotto.

Sono gestiti, quando presenti:

- EAN;
- peso;
- categoria;
- produttore;
- nome;
- descrizione;
- prezzo;
- stock;
- immagine, nei limiti attuali.

Se non ci sono differenze il prodotto viene considerato invariato e viene saltato.

Questo permette di distinguere chiaramente:

- CREATE;
- UPDATE;
- SKIP.

---

## 3. Protezione DRY_RUN

È stato corretto un problema importante che poteva permettere un UPDATE anche durante una simulazione.

Ora tutte le scritture API passano attraverso una protezione centralizzata.

Con:

`DRY_RUN=true`

le operazioni di scrittura verso Base.com vengono bloccate.

Questo vale anche per:

- prodotti;
- categorie;
- produttori.

Il file `.env.example` utilizza ora:

`DRY_RUN=true`

come valore predefinito sicuro.

`DRY_RUN` protegge le scritture verso Base.com, ma non impedisce la generazione locale del JSON durante la conversione XML → JSON.

---

## 4. Prezzi maggiori di 999 €

È stato corretto il parsing dei prezzi con separatore delle migliaia italiano.

Esempi:

- `25,00 EUR` → `25`
- `999,00 EUR` → `999`
- `1.098,00 EUR` → `1098`
- `4.880,00 EUR` → `4880`
- `0.1 Kg` → `0.1`
- `1.234.567,89 EUR` → `1234567.89`

Formati ambigui o malformati come:

`1.09,00 EUR`

vengono rifiutati.

---

## 5. SKU duplicati nel feed

Il controllo dei duplicati è stato integrato nel flusso reale.

Il sistema distingue due situazioni.

### Duplicati equivalenti

Se due record con lo stesso SKU contengono gli stessi dati rilevanti, viene mantenuta una sola occorrenza.

Le occorrenze duplicate vengono conteggiate nel report finale.

### Duplicati in conflitto

Se lo stesso SKU contiene dati differenti rilevanti, ad esempio:

- prezzo differente;
- titolo differente;
- descrizione differente;
- categoria differente;
- altri campi importati differenti;

il sistema non sceglie arbitrariamente quale prodotto utilizzare.

Il caso viene segnalato come problematico prima della scrittura.

Nel feed utilizzato durante la verifica finale sono stati letti:

- 128 record;
- 114 SKU unici;
- 14 occorrenze duplicate saltate.

---

## 6. SKU ambigui su Base.com

La ricerca dei prodotti su Base.com utilizza lo SKU come identità principale.

Non viene utilizzato EAN come fallback automatico.

Se Base.com restituisce più prodotti compatibili con lo stesso SKU, il sistema non sceglie arbitrariamente il primo risultato.

Lo SKU viene considerato ambiguo e il prodotto viene bloccato.

Questo riduce il rischio di aggiornare il prodotto sbagliato.

---

## 7. Categorie automatiche

È stato introdotto:

`src/categories.js`

Le categorie vengono riconosciute utilizzando:

- nome normalizzato;
- `parent_id`.

Questo permette di gestire categorie con lo stesso nome sotto gerarchie differenti.

Esempio:

Bellezza  
→ Cura corpo  
→ Creme

Se una categoria manca, può essere creata automaticamente.

Dopo la creazione la mappa locale viene aggiornata per evitare duplicazioni durante la stessa esecuzione.

Categorie omonime o ambigue non vengono scelte arbitrariamente.

---

## 8. Produttori

La gestione dei produttori è stata centralizzata.

Prima esistevano logiche parzialmente separate tra import prodotti e comando `productor`.

Ora utilizzano la stessa infrastruttura.

I nomi vengono normalizzati per evitare duplicati causati da:

- maiuscole/minuscole;
- spazi iniziali/finali;
- spazi multipli.

Esempio:

`Carlo Bay`

` carlo   bay `

`CARLO BAY`

vengono riconosciuti come lo stesso produttore.

La mappa viene aggiornata immediatamente dopo una nuova creazione.

In caso di produttori omonimi associati a ID differenti, il sistema evita di scegliere arbitrariamente.

---

## 9. Inventory e warehouse

Senza configurazione esplicita viene individuato l'inventory marcato da Base.com come Default.

Attualmente il codice conserva ancora il supporto opzionale a:

`BASE_INVENTORY_ID`

Nel file `.env` attuale questa variabile non viene utilizzata.

Se viene specificato un ID non valido, il sistema genera errore invece di utilizzare arbitrariamente un'altra inventory.

Il gruppo prezzi Default viene individuato esplicitamente.

Il warehouse viene recuperato soltanto quando il prodotto contiene una quantità da sincronizzare.

Non vengono inventati warehouse o valori di stock fittizi.

---

## 10. Sanitizzazione testi e Unicode

Durante le verifiche reali è stato individuato un problema di idempotenza legato alle descrizioni provenienti dal feed Vudoo.

Alcuni file XML contengono emoji o caratteri Unicode non-BMP, ad esempio:

- `💧`
- `🖤`
- `🖌️`
- `🌿`
- `🌺`

Base.com non conserva correttamente alcuni di questi caratteri e li restituisce come `?`.

Esempio:

Feed:

`💧 Modo d'uso`

Base.com dopo il salvataggio:

`? Modo d'uso`

Il confronto letterale considerava quindi il prodotto diverso ad ogni sincronizzazione e generava continuamente nuovi UPDATE.

È stata introdotta:

`sanitizeTextForBase()`

La funzione elimina dai testi destinati a Base.com i caratteri Unicode fuori dal BMP e gli eventuali selettori di variante associati.

La sanitizzazione:

- viene applicata prima della costruzione dei `text_fields`;
- viene utilizzata sia per CREATE sia per UPDATE;
- viene utilizzata anche durante il confronto con i dati esistenti;
- non modifica il prodotto sorgente;
- non modifica `VUDOO.xml`;
- non modifica direttamente il JSON sorgente.

Vengono preservati caratteri supportati come:

- accenti;
- apostrofi tipografici;
- `–`;
- `€`;
- `✨`.

La funzione corregge soltanto gli spazi direttamente coinvolti nella rimozione dei caratteri incompatibili, evitando normalizzazioni aggressive delle descrizioni.

Dopo la correzione, una descrizione come:

`Test 💧 descrizione`

viene confrontata con Base.com come:

`Test descrizione`

Se Base contiene già questa versione, non viene generato alcun UPDATE.

---

## 11. Report finale

Il riepilogo dell'importazione distingue:

- prodotti creati;
- prodotti aggiornati;
- prodotti invariati;
- prodotti simulati;
- duplicati nel feed;
- errori.

Gli SKU che generano errori vengono riportati nel riepilogo finale.

Esempio di struttura:

- Prodotti letti;
- Prodotti selezionati;
- Prodotti processati;
- Creati;
- Aggiornati;
- Saltati perché invariati;
- Duplicati nel feed saltati;
- Simulati;
- Errori;
- SKU con errori, quando presenti.

La leggibilità generale dei log durante l'esecuzione può ancora essere migliorata in un intervento futuro.

---

## 12. Test automatici

È presente una suite automatica permanente.

Comando:

`npm test`

La suite attuale contiene:

**53 test**

Tutti i 53 test risultano superati nella verifica finale della release.

I test coprono, tra le altre cose:

- parsing prezzi;
- validazioni;
- SKU duplicati;
- SKU ambigui su Base.com;
- payload;
- prodotti nuovi;
- prodotti esistenti;
- CREATE;
- UPDATE;
- SKIP;
- categorie;
- produttori;
- inventory;
- warehouse;
- DRY_RUN;
- errori HTTP/API/rete;
- contatori del report;
- CLI;
- flusso sync;
- propagazione degli exit code;
- fallimento della conversione;
- fallimento dell'import;
- sanitizzazione Unicode;
- idempotenza della sanitizzazione;
- idempotenza degli UPDATE;
- conversione XML → JSON senza sovrascrivere il file reale durante i test.

I test devono essere rieseguiti dopo le future modifiche al progetto.

Quando vengono introdotte nuove funzionalità devono essere aggiunti nuovi test specifici.

---

## 13. CLI e orchestrazione

È stata introdotta una CLI interattiva per rendere lo script utilizzabile senza dover conoscere tutti i singoli comandi npm.

Comando principale:

`npm start`

Il menu permette di scegliere:

1. Converti XML → JSON
2. Sincronizza produttori
3. Importa / aggiorna prodotti su Base.com
4. Esegui flusso completo
5. Esegui test automatici
6. Esci

Il menu mostra anche lo stato corrente di:

- `DRY_RUN`;
- `TEST_MODE`.

La CLI non modifica automaticamente `.env`.

Dopo le operazioni è possibile tornare al menu oppure uscire.

In alcuni casi è anche possibile proseguire direttamente con lo step successivo.

I singoli comandi tecnici restano disponibili:

- `npm start`
  - apre la CLI;

- `npm run import`
  - esegue direttamente l'importazione;

- `npm run convert`
  - esegue soltanto la conversione XML → JSON;

- `npm run productor`
  - sincronizza separatamente i produttori;

- `npm run sync`
  - esegue conversione → importazione;

- `npm test`
  - esegue la suite automatica.

### Flusso completo

`npm run sync`

esegue:

conversione XML → JSON  
→ importazione prodotti

Il comando `productor` non viene eseguito automaticamente all'interno del sync perché il normale import gestisce già i produttori mancanti tramite la logica condivisa.

Eseguirlo prima dell'import produrrebbe chiamate API ridondanti.

Se la conversione fallisce, l'importazione non viene avviata.

Questo evita di importare accidentalmente un vecchio JSON dopo un errore di conversione.

---

## 14. Verifiche Base.com

Sono state effettuate verifiche contro Base.com reale.

Durante gli smoke test iniziali sono state utilizzate esclusivamente operazioni API di lettura.

Sono stati verificati:

- inventory;
- gruppo prezzi;
- prodotti esistenti;
- categorie;
- produttori;
- selezione warehouse quando necessaria.

Successivamente è stata eseguita una sincronizzazione reale controllata per correggere le descrizioni che contenevano `?` generati in precedenza da Base.com al posto delle emoji non supportate.

Dopo questa sincronizzazione è stata eseguita una nuova importazione completa con:

`DRY_RUN=true`

e:

`TEST_MODE=false`

Il risultato finale è stato:

- Inventory: Default `(115064)`
- Gruppo prezzi: Default `(100318, EUR)`
- Warehouse: non necessario
- Prodotti letti: `128`
- Prodotti selezionati: `114`
- Prodotti processati: `114`
- Creati: `0`
- Aggiornati: `0`
- Saltati perché invariati: `114`
- Duplicati nel feed saltati: `14`
- Simulati: `0`
- Errori: `0`

La sincronizzazione è quindi risultata idempotente sul feed utilizzato:

rieseguendo l'importazione senza modifiche ai dati non vengono generati UPDATE inutili.

---

## 15. Rate limit Base.com

Durante le verifiche intensive è stato raggiunto il limite di richieste delle API Base.com.

L'API ha restituito:

`ERROR_BLOCKED_TOKEN - Query limit exceeded`

Il token è stato temporaneamente bloccato dalle API.

Questo ha permesso di confermare che la gestione del rate limit non è soltanto un rischio teorico ma un caso reale da affrontare.

La relativa Issue è stata aggiornata e portata a priorità alta.

La release `v1.1.0` non introduce ancora un sistema completo di:

- throttling;
- retry;
- backoff;
- gestione degli esiti incerti delle scritture.

Questi aspetti verranno affrontati in una fase successiva.

Durante l'utilizzo corrente è quindi necessario evitare esecuzioni ripetute inutili contro Base.com.

---

## 16. Problemi ancora aperti

Restano da affrontare:

- gestione rate limit API;
- gestione degli esiti incerti delle scritture;
- miglioramento leggibilità log console;
- confronto e sostituzione immagini già presenti sulla CDN Base.com;
- integrità e provenienza del JSON;
- sincronizzazione stock completa;
- dati Vudoo mancanti;
- connessione diretta API Vudoo;
- aggiornamento della documentazione generale;
- pulizia `node_modules` dal tracking Git;
- eventuale rimozione futura del wrapper `update-inventory.js`;
- verifica e rimozione di altri file legacy non più necessari.

Questi elementi non bloccano la release `v1.1.0`, ma restano tracciati per gli sviluppi successivi.

---

## 17. Prossimi step

Dopo la release `v1.1.0` sono pianificati:

1. gestione del rate limit API e degli esiti incerti delle scritture;
2. miglioramento della leggibilità dei log console;
3. verifica e gestione delle immagini già presenti sulla CDN Base.com;
4. sincronizzazione stock completa;
5. verifica della provenienza e integrità del JSON;
6. connessione diretta alle API Vudoo;
7. aggiornamento della documentazione generale;
8. rimozione di `node_modules` dal versionamento Git;
9. cleanup dei wrapper e dei file legacy non più necessari;
10. ampliamento progressivo della suite di test per le nuove funzionalità.

---

# Stato finale v1.1.0

La release `v1.1.0` introduce un flusso di sincronizzazione più sicuro, verificabile e semplice da utilizzare.

## CLI e orchestrazione

- `npm start` apre un menu interattivo.
- `npm run import` esegue direttamente l'importazione.
- `npm run sync` esegue conversione XML → JSON e importazione.
- `npm run convert`, `npm run productor` e `npm test` restano disponibili.
- Il flusso completo non esegue `productor` separatamente perché l'import gestisce già i produttori mancanti.

## Sicurezza e sincronizzazione

- `DRY_RUN` protegge tutte le scritture su Base.com.
- `.env.example` utilizza `DRY_RUN=true` come valore sicuro predefinito.
- Gli UPDATE inviano soltanto i campi realmente modificati.
- Gli SKU ambigui su Base.com vengono bloccati.
- I duplicati equivalenti nel feed vengono deduplicati.
- Inventory Default e gruppo prezzi Default vengono individuati esplicitamente.
- Non vengono utilizzati fallback arbitrari per inventory, SKU o warehouse.

## Testi e Unicode

Alcuni feed Vudoo contengono emoji Unicode non supportate correttamente da Base.com.

Base sostituiva alcuni caratteri con `?`, causando UPDATE ripetuti ad ogni sincronizzazione.

È stata introdotta:

`sanitizeTextForBase()`

per eliminare i caratteri Unicode non-BMP dai testi destinati a Base.com, preservando caratteri supportati come:

- accenti;
- apostrofi tipografici;
- `–`;
- `€`;
- `✨`.

La sanitizzazione viene utilizzata sia per CREATE sia per il confronto UPDATE.

Il file XML originale non viene modificato.

## Test

La suite automatica contiene:

**53 test**

Risultato finale:

- Test: `53`
- Passati: `53`
- Falliti: `0`

La suite copre anche:

- CLI e sync;
- DRY_RUN;
- CREATE / UPDATE / SKIP;
- parsing prezzi;
- categorie;
- produttori;
- SKU duplicati e ambigui;
- inventory e warehouse;
- gestione errori API;
- sanitizzazione Unicode;
- idempotenza degli UPDATE.

## Verifica reale finale

Feed utilizzato:

- 128 record letti;
- 114 SKU unici;
- 14 duplicati del feed saltati.

Dopo l'allineamento con Base.com è stata eseguita una nuova importazione completa.

Risultato:

- Creati: `0`
- Aggiornati: `0`
- Invariati: `114`
- Simulati: `0`
- Errori: `0`

La sincronizzazione è quindi risultata idempotente sul feed testato.

## Limitazioni note

Durante le verifiche è stato raggiunto il rate limit delle API Base.com con errore:

`ERROR_BLOCKED_TOKEN`

La relativa Issue resta aperta con priorità alta per introdurre una gestione controllata del rate limit e degli esiti incerti delle richieste.

Restano inoltre aperti sviluppi non necessari alla `v1.1.0`, tra cui:

- connessione diretta alle API Vudoo;
- sincronizzazione stock;
- gestione avanzata immagini;
- miglioramento dei log;
- documentazione generale;
- cleanup del codice legacy.

---

## Conclusione

La versione `v1.1.0` porta il progetto da un insieme di script tecnici separati a un flusso di sincronizzazione più strutturato e utilizzabile.

Il sistema dispone ora di:

- CLI interattiva;
- flusso completo automatizzato;
- UPDATE selettivi;
- deduplicazione SKU;
- gestione centralizzata di categorie e produttori;
- protezioni DRY_RUN;
- sanitizzazione dei testi incompatibili con Base.com;
- report finale;
- 53 test automatici;
- verifica reale di idempotenza.

Il progetto è quindi pronto per essere utilizzato e presentato nella configurazione attuale, mantenendo tracciati separatamente gli interventi di robustezza e sviluppo previsti per le versioni successive.