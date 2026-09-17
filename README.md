# Easy Script Vudoo (v1.1.0)

## 📋 Descrizione Aggiornata del Progetto
**Easy Script Vudoo** è un applicativo robusto e automatizzato progettato per gestire il flusso di sincronizzazione e aggiornamento dei prodotti[cite: 2]. Il sistema gestisce l'estrazione e la trasformazione dei dati partendo da sorgenti XML strutturate (Vudoo), convertendole in oggetti JSON compatibili, ed eseguendo l'upsert e l'aggiornamento massivo o mirato sulla piattaforma e-commerce **Base.com**[cite: 2].

## ⚙️ Requisiti Principali
Per eseguire e sviluppare il progetto sono necessari i seguenti strumenti:
* **Node.js**: Versione 18.x o superiore raccomandata.
* **npm**: Gestore di pacchetti incluso con Node.js.
* Accesso alle API e credenziali valide per **Base.com**[cite: 2] e per il tracciato **Vudoo XML**[cite: 2].

## 📥 Installazione
Clona il repository ed installa le dipendenze locali eseguendo i seguenti comandi nel terminale:

# Clona il repository
git clone <URL_DEL_REPOSITORY>

# Entra nella cartella del progetto
```bash
cd easy_script_vudoo
```

# Installa le dipendenze
npm install

## ⚙️ Configurazione (.env)
Prima di avviare lo script, è necessario configurare le variabili d'ambiente. Crea un file denominato `.env` nella root del progetto prendendo spunto dall'esempio qui sotto:

# Configurazione Base.com
BASE_API_TOKEN=il_tuo_token_api_base_com
BASE_API_URL=[https://api.base.com/v1/](https://api.base.com/v1/)

# Configurazione Sorgente Vudoo XML
VUDOO_XML_URL=https://url-del-tuo-fornitore/vudoo/prodotti.xml

# Altre impostazioni (opzionali)
LOG_LEVEL=info

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

All'interno della cartella `src/`, i file e le sottocartelle principali svolgono ruoli specifici per il funzionamento dell'applicativo:

* **`src/index.js`**: È il punto di ingresso (*entry point*) dell'applicazione; coordina l'avvio del flusso di sincronizzazione richiamando i vari servizi in sequenza.
* **`src/config/`**: Contiene i file per la validazione e il caricamento centralizzato delle variabili d'ambiente (es. credenziali e URL).
* **`src/services/`**: Ospita la logica core, tra cui il modulo per il download e il parsing del tracciato Vudoo XML, la trasformazione in formato JSON e il client per la comunicazione con le API di Base.com.
* **`src/utils/`**: Raccoglie funzioni di supporto trasversali, come la formattazione dei log, la gestione degli errori e strumenti di utilità generale.

## 🔄 Flusso Vudoo XML → JSON → Base.com
Il processo di sincronizzazione dei prodotti segue una pipeline sequenziale ben definita per garantire l'integrità dei dati:

1. **Estrazione (Fetch):** Lo script esegue una richiesta per prelevare il tracciato dei prodotti aggiornato dal fornitore in formato XML (`Vudoo XML`).
2. **Trasformazione (Parsing & Mapping):** I dati XML vengono letti, convertiti ed elaborati in strutture dati pulite in formato `JSON`, mappando i campi del fornitore sugli attributi richiesti dalla destinazione.
3. **Sincronizzazione (Upsert su Base.com):** I dati trasformati vengono inviati tramite chiamate API alla piattaforma e-commerce `Base.com`, eseguendo operazioni di inserimento o aggiornamento (*upsert*) basate sugli SKU o sugli identificativi univoci dei prodotti.

## 💻 Utilizzo della CLI
L'applicativo può essere eseguito direttamente da riga di comando (CLI). È possibile passare parametri specifici o flag per controllare il comportamento dello script durante l'esecuzione:

* **Esecuzione standard:**
  ```bash
  npm start

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