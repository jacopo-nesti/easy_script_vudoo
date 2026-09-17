# Vudoo → Base.com Product Importer

Script Node.js per automatizzare l'importazione dei cataloghi prodotto da **Vudoo** verso **Base.com**.

Il progetto nasce per semplificare un processo che altrimenti richiederebbe la gestione e l'inserimento manuale dei dati prodotto.

## Documentazione

- [Guida operativa](docs/GUIDA.md)
- [Roadmap](docs/ROADMAP.md)
- [Workflow Git](docs/WORKFLOW.md)
- [Commit Guidelines](docs/COMMIT_GUIDELINES.md)

## Flusso attuale

```text
Panel Vudoo
    ↓
Download catalogo Google XML
    ↓
convert_xml_to_json.js
    ↓
real_products.json
    ↓
CLI (cli.js) / Sync (sync.js)
    ↓
Normalizzazione dati
    ↓
Controllo SKU / duplicati
    ↓
Creazione payload
    ↓
API Base.com
    ↓
Catalogo Base.com
```

## Funzionalità

Attualmente lo script permette di:

- convertire il catalogo XML Vudoo in JSON;
- normalizzare i dati dei prodotti;
- associare ID e SKU;
- preparare prezzi, peso, EAN, descrizioni e immagini;
- selezionare l'inventory Base.com di destinazione;
- recuperare automaticamente il gruppo prezzi;
- controllare se uno SKU è già presente;
- evitare la creazione di prodotti duplicati;
- testare un solo prodotto tramite `TEST_MODE`;
- simulare l'importazione senza scrivere su Base.com tramite `DRY_RUN`;
- importare automaticamente i prodotti tramite API Base.com;
- continuare l'elaborazione anche in caso di errore su un singolo prodotto.

## Modalità

```env
TEST_MODE=true
```

Processa solamente un prodotto.

```env
DRY_RUN=true
```

Esegue i controlli e genera il payload senza creare prodotti su Base.com.

Per l'importazione completa:

```env
TEST_MODE=false
DRY_RUN=false
```

## Avvio

Conversione del catalogo:

```bash
npm run convert
```

Avvio dello script:

```bash
npm start
```

**Per la procedura completa di configurazione e utilizzo consulta [GUIDA.md](docs/GUIDA.md).**

## Evoluzione prevista

Lo sviluppo futuro potrà includere:

```text
Vudoo API
    ↓
GET prodotti
    ↓
Normalizzazione
    ↓
CREATE / UPDATE / SKIP
    ↓
Base.com
```

In particolare:

- collegamento diretto alle API Vudoo;
- eliminazione del download XML manuale;
- aggiornamento automatico dei prodotti già esistenti;
- creazione automatica di categorie;
- creazione automatica dei produttori;
- sincronizzazione di prezzi e stock.

L'obiettivo finale è trasformare lo script in un piccolo **connettore automatico Vudoo → Base.com**.

## Progetto

**Ideazione, progettazione del flusso, coordinamento e sviluppo:** Jacopo Nesti

Sviluppato durante il periodo di stage con il supporto del team.
