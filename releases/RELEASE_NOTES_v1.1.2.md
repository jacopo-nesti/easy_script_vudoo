# Release v1.1.2

## Panoramica

La versione `v1.1.2` consolida il flusso di sincronizzazione Vudoo → Base.com, migliorando la gestione dello stock, la sicurezza delle chiamate API, la documentazione e la stabilità generale del progetto.

## Novità principali

### Gestione stock

- supporto alle quantità numeriche reali;
- quantità superiori a `10` mantenute senza limitazioni;
- fallback `in stock → 10` quando manca una quantità numerica;
- `out of stock → 0`;
- stringhe vuote e valori `null` gestiti come quantità mancanti;
- warehouse recuperato e validato correttamente;
- nessun UPDATE dello stock quando il valore è già corretto.

### API Base.com

- rate limiting adattivo;
- piena velocità quando il volume di richieste è basso;
- rallentamento automatico vicino alla soglia configurata;
- retry controllati per le operazioni di lettura;
- nessun retry automatico alla cieca sulle scritture;
- verifica dello stato dopo CREATE o UPDATE con esito incerto;
- segnalazione separata degli SKU con risultato incerto.

### Sicurezza

- `DRY_RUN` continua a bloccare tutte le scritture reali;
- mantenuta la guardia read-only;
- inventory e warehouse continuano a essere validati;
- nessun token o credenziale incluso nel repository.

### Cleanup

Rimossi file obsoleti e non più utilizzati:

- `update-inventory.js`
- `docs/api_documentation.md`

Mantenuti i file ancora utili alla sicurezza e al flusso corrente.

### Documentazione

- README aggiornato allo stato reale del progetto;
- requisiti Node.js aggiornati;
- comandi npm verificati;
- struttura del progetto aggiornata;
- documentati stock, preflight, rate limiting, DRY_RUN e gestione degli esiti incerti;
- aggiunta la sezione autori e contributi.

## Test

La suite automatica comprende:

- **110 test**
- **110 superati**
- **0 falliti**

Verificati inoltre:

- `npm start`
- `npm run sync` in modalità sicura
- controllo sintattico
- `git diff --check`

## Stato

Questa release rappresenta un punto stabile prima dell'integrazione diretta con i Web Services/API Vudoo.