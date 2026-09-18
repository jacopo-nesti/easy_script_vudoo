# Easy Script Vudoo (v1.1.0)

## 📋 Descrizione del Progetto
**Easy Script Vudoo** è un applicativo robusto e automatizzato progettato per gestire il flusso di sincronizzazione e aggiornamento dei prodotti. Il sistema gestisce l'estrazione e la trasformazione dei dati partendo da sorgenti XML strutturate (Vudoo), convertendole in oggetti JSON compatibili, ed eseguendo l'upsert e l'aggiornamento massivo o mirato sulla piattaforma e-commerce **Base.com**.

## ⚙️ Requisiti Principali
Per eseguire e sviluppare il progetto sono necessari i seguenti strumenti:
* **Node.js**: Versione 18.x o superiore raccomandata.
* **npm**: Gestore di pacchetti incluso con Node.js.
* Accesso alle API e credenziali valide per **Base.com**[cite: 2] e per il tracciato **Vudoo XML**[cite: 2].

## 📥 Installazione
Clona il repository ed installa le dipendenze locali eseguendo i seguenti comandi nel terminale:

```bash
# Clona il repository
git clone <URL_DEL_REPOSITORY>
```

```bash
# Entra nella cartella del progetto
cd easy_script_vudoo
```
```bash
# Installa le dipendenze
npm install
```

## ⚙️ Configurazione (.env)

Prima di avviare lo script, è necessario configurare le variabili d'ambiente. Per la guida dettagliata su come impostare la configurazione di Base.com e la sorgente Vudoo XML, fai riferimento al file di documentazione dedicato:

* [Guida alla Configurazione](./configurazione.md)

## 📂 Struttura Attuale delle Cartelle e dei Moduli
Il progetto è organizzato in modo modulare per separare la logica di recupero dati, la trasformazione e l'interazione con le API esterne:

easy_script_vudoo/
├── src/
│   ├── config/          # Gestione delle configurazioni e variabili d'ambiente
│   ├── services/        # Logica di business (fetching XML, parsing, API Base.com)
│   ├── utils/           # Funzioni di supporto e gestione log
│   └── index.js         # Entry point principale dell'applicazione
├── .env                 # Variabili d'ambiente (non tracciato da Git)
├── package.json         # Dipendenze e script npm
└── README.md            # Documentazione del progetto

## 🛠️ Ruolo dei Principali File dentro `src/`

Per mantenere una codebase pulita, manutenibile e scalabile secondo il principio di responsabilità singola (Single Responsibility Principle), la cartella `src/` è organizzata nei seguenti moduli:

### 1. Entry Point Principale
* **`src/index.js`**
  * **Ruolo:** Punto di ingresso principale dell'applicazione.
  * **Compiti:** Gestisce il flusso sequenziale della sincronizzazione (Estrazione -> Trasformazione -> Sincronizzazione), cattura le eccezioni globali e traccia i log di avvio e completamento del processo.

### 2. Configurazione e Validazione (`src/config/`)
* **`src/config/index.js`**
  * **Ruolo:** Centralizza la gestione delle configurazioni.
  * **Compiti:** Carica e valida le variabili d'ambiente tramite `dotenv`, verificando preventivamente la presenza e la correttezza di parametri critici (come token API e URL dei feed XML).

### 3. Logica di Business e Servizi (`src/services/`)
* **`src/services/vudooService.js`**
  * **Ruolo:** Gestione dei dati di origine.
  * **Compiti:** Effettua il download del tracciato XML dal server del fornitore ed esegue il parsing iniziale dei dati grezzi.
* **`src/services/transformService.js`**
  * **Ruolo:** Mappatura e trasformazione dati.
  * **Compiti:** Converte la struttura XML in oggetti JSON puliti, applicando le regole di mappatura per SKU, prezzi, categorie e descrizioni richiesti dalla piattaforma di destinazione.
* **`src/services/baseService.js`**
  * **Ruolo:** Interazione con le API esterne.
  * **Compiti:** Gestisce le chiamate HTTP (inserimenti e aggiornamenti di tipo *upsert*) verso Base.com, gestendo eventuali errori di rete o limiti di frequenza (*rate limiting*).

### 4. Utility e Supporto (`src/utils/`)
* **`src/utils/logger.js`**
  * **Ruolo:** Sistema di logging centralizzato.
  * **Compiti:** Configura e standardizza i livelli di log (`info`, `warn`, `error`) per monitorare l'esecuzione dello script e facilitare il debug.
* **`src/utils/errorHandler.js`**
  * **Ruolo:** Gestione unificata degli errori.
  * **Compiti:** Intercetta le eccezioni provenienti dai servizi di rete o di parsing, garantendo una gestione pulita degli errori senza interruzioni impreviste.

## 🔄 Flusso Vudoo XML → JSON → Base.com

Il processo di sincronizzazione dei prodotti all'interno di **Easy Script Vudoo** segue una pipeline sequenziale e modulare, progettata per garantire l'affidabilità, la coerenza e l'integrità dei dati tra il fornitore e la piattaforma e-commerce[cite: 2].

Il flusso si articola in tre macro-fasi principali gestite dai servizi residenti in `src/services/`:

### 1. 📥 Estrazione (Fetch del tracciato Vudoo XML)
* **Recupero dei dati:** Lo script effettua una richiesta HTTP (o legge da sorgente configurata) utilizzando l'URL specificato nella variabile d'ambiente `VUDOO_XML_URL`.
* **Gestione dello stream:** Il documento XML viene scaricato in memoria o elaborato tramite stream per ottimizzare l'uso delle risorse di sistema, specialmente in presenza di cataloghi di grandi dimensioni.

### 2. ⚙️ Trasformazione (Parsing & Mapping XML → JSON)
* **Parsing strutturato:** Il file XML viene analizzato e convertito in oggetti nativi in formato `JSON` puliti e normalizzati.
* **Mappatura degli attributi:** I campi specifici del fornitore (es. codici articolo, descrizioni, prezzi, immagini e categorie) vengono mappati sugli attributi standard richiesti dalle API di destinazione.
* **Filtri di controllo:** Vengono applicate le regole di validazione preliminare (come il controllo sui prezzi o sugli SKU mancanti) e, se la modalità `TEST_MODE` è attiva, il set di dati viene ridotto a un campione limitato per velocizzare l'elaborazione[cite: 10].

### 3. 🚀 Sincronizzazione (Upsert su Base.com)
* **Comunicazione API:** I dati JSON trasformati vengono impacchettati e inviati tramite chiamate alle API ufficiali di **Base.com** (`BASE_API_URL`)[cite: 2].
* **Operazione di Upsert:** Il sistema esegue un'operazione di inserimento o aggiornamento (*upsert*) basata sul riconoscimento univoco dello SKU, evitando duplicati e aggiornando solo le informazioni variate (es. giacenze di magazzino e listini prezzi).
* **Controllo `DRY_RUN`:** Se la variabile `DRY_RUN=true` è attiva nel file `.env`, l'intero flusso di estrazione e parsing viene completato con successo, ma la chiamata finale di scrittura su Base.com viene simulata e intercettata dai log, impedendo modifiche reali sul catalogo live[cite: 10].

> **Nota di Sicurezza:** Tutti gli errori riscontrati nelle singole fasi (fallimento del download XML, errori di parsing o risposte anomale dalle API di Base.com) vengono catturati dal modulo di gestione log (`src/utils/`) per facilitare le attività di debugging e tracciabilità.

## 💻 Utilizzo della CLI
L'applicativo può essere eseguito direttamente da riga di comando (CLI). È possibile passare parametri specifici o flag per controllare il comportamento dello script durante l'esecuzione:

* **Esecuzione standard:**
  ```bash
  npm start
  ```
## 📦 Elenco Aggiornato dei Comandi npm
Di seguito sono elencati i comandi disponibili nel file `package.json` per la gestione, lo sviluppo e l'esecuzione del progetto:

* `npm start`: Avvia l'applicazione in modalità di produzione eseguendo lo script principale.
* `npm run dev`: Avvia l'applicazione in modalità sviluppo (sfruttando strumenti come `nodemon` per il riavvio automatico ad ogni modifica del codice).
* `npm test`: Esegue la suite di test automatizzati configurati per il progetto.
* `npm run lint`: Esegue il controllo della qualità del codice tramite linter (se configurato).

## 🔍 Spiegazione di `DRY_RUN`
La modalità `DRY_RUN` (attivabile tramite le variabili d'ambiente o come flag) permette di eseguire l'intero flusso di recupero (Vudoo XML) e trasformazione (JSON) **senza tuttavia applicare modifiche reali** sulla piattaforma e-commerce (Base.com). 

* **A cosa serve:** È utile in fase di test o debug per verificare che il parsing dei dati avvenga correttamente e per controllare quali prodotti verrebbero creati o aggiornati, evitando di scrivere o sovrascrivere dati sul catalogo live.
* **Come attivarla:** Impostare nel file `.env` la variabile `DRY_RUN=true`.

## 🧪 Spiegazione di `TEST_MODE`
La modalità `TEST_MODE` consente di eseguire l'applicazione in un ambiente controllato e circoscritto, ideale per le fasi di collaudo o sviluppo locale.

* **A cosa serve:** Limita il volume delle operazioni (ad esempio processando solo un sottoinsieme ridotto di prodotti anziché l'intero catalogo) per velocizzare i riscontri ed evitare di sovraccaricare le API esterne durante le verifiche.
* **Come attivarla:** Configurare la variabile corrispondente nel file `.env` impostandola su `TEST_MODE=true`.

## 🧪 Sezione Test Automatici
Il progetto include una suite di test pensata per verificare la correttezza della logica di parsing, trasformazione e interazione con i servizi:

* **Esecuzione dei test:** Per lanciare tutti i test configurati, utilizza il comando:
  ```bash
  npm test

## 📚 Link alla Documentazione Secondaria
Per approfondire aspetti specifici del progetto, guide avanzate o integrazioni particolari, puoi fare riferimento ai seguenti documenti all'interno del repository:
* [Guida alle API di Base.com](./docs/base-api.md) - Approfondimento sui metodi di chiamata e gestione dei token.
* [Tracciato Vudoo XML](./docs/vudoo-schema.md) - Dettagli sui campi mappati e sulla struttura del fornitore.
* [Log delle Module e Changelog](./CHANGELOG.md) - Cronologia completa delle versioni e delle modifiche introdotte.