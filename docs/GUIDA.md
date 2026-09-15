# Manuale operativo — Importazione catalogo Vudoo → Base.com

Questo script permette di importare un catalogo prodotti da **Vudoo** a **Base.com**.

## Flusso attuale

```text
Catalogo Vudoo (.xml)
        ↓
convert_xml_to_json.js
        ↓
real_products.json
        ↓
index.js
        ↓
API Base.com
        ↓
Catalogo Base.com
```

---

# 1. Requisiti

Sul PC devono essere installati:

```text
Node.js >= 22
npm
VS Code
```

`npm` viene installato insieme a Node.js.

Verifica dal terminale:

```bash
node -v
npm -v
```

Se entrambi restituiscono una versione, puoi procedere.

---

# 2. Apri il progetto

Apri la cartella del progetto con VS Code:

```text
File → Open Folder
```

Poi apri il terminale integrato:

```text
Terminal → New Terminal
```

---

# 3. Installa le dipendenze

La prima volta che utilizzi il progetto esegui:

```bash
npm install
```

Questo comando installa le dipendenze indicate nel `package.json`.

Attualmente il progetto utilizza:

```text
fast-xml-parser
```

Non è necessario ripetere `npm install` a ogni avvio.

Va rieseguito principalmente:

- dopo aver clonato/coperto il progetto su un nuovo PC;
- quando vengono aggiunte o modificate dipendenze.

---

# 4. Configura `.env`

Nel progetto è presente:

```text
.env.example
```

Questo file contiene le variabili necessarie allo script, ma **non contiene credenziali reali**.

Esempio:

```env
BASE_API_TOKEN=
BASE_INVENTORY_ID=
BASE_WAREHOUSE_ID=
TEST_MODE=true
DRY_RUN=true
```

Crea una copia di:

```text
.env.example
```

e rinominala:

```text
.env
```

Lo script utilizzerà il file `.env` locale.

---

## `BASE_API_TOKEN`

Inserisci un token API Base.com valido:

```env
BASE_API_TOKEN=INSERISCI_TOKEN_BASE
```

Ogni collaboratore dovrebbe utilizzare, quando possibile, il proprio token API.

```text
Collaboratore A → proprio .env → proprio token
Collaboratore B → proprio .env → proprio token
Collaboratore C → proprio .env → proprio token
```

Il token:

- non deve essere inserito nella repository;
- non deve essere scritto in `.env.example`;
- non deve essere condiviso dentro file versionati.

Se un token viene accidentalmente pubblicato o inserito nella cronologia Git, deve essere sostituito/revocato.

---

## `BASE_INVENTORY_ID`

Indica l'inventory Base.com nel quale verranno importati i prodotti.

Esempio inventory Wally di test:

```env
BASE_INVENTORY_ID=115966
```

Lo script verifica tramite API che l'inventory esista e recupera automaticamente il gruppo prezzi associato.

---

## `BASE_WAREHOUSE_ID`

Indica il warehouse Base.com da utilizzare quando è necessario gestire quantità di stock.

```env
BASE_WAREHOUSE_ID=
```

Se il catalogo non contiene quantità numeriche di stock, questa configurazione può non essere necessaria.

---

## `TEST_MODE`

Decide **quanti prodotti vengono processati**.

```env
TEST_MODE=true
```

→ processa solamente il primo prodotto.

```env
TEST_MODE=false
```

→ processa tutti i prodotti.

---

## `DRY_RUN`

Decide **se effettuare realmente modifiche su Base.com**.

```env
DRY_RUN=true
```

→ esegue controlli e genera il payload, ma **non crea prodotti**.

```env
DRY_RUN=false
```

→ esegue realmente le chiamate API e può creare prodotti su Base.com.

---

## Sicurezza `.env`

Il file:

```text
.env
```

contiene dati sensibili e **non deve essere caricato su GitHub**.

Nel `.gitignore` deve essere presente:

```gitignore
.env
```

Il file:

```text
.env.example
```

deve invece rimanere nella repository.

```text
.env.example → GitHub ✅
.env         → GitHub ❌
```

---

# 5. Scarica il catalogo da Vudoo

Dal Panel Vudoo scarica il catalogo prodotti in formato:

```text
Google XML
```

Il file avrà estensione:

```text
.xml
```

Copia il file XML nella cartella principale del progetto.

Esempio:

```text
products-to-base/
│
├── index.js
├── convert_xml_to_json.js
├── package.json
├── .env
├── .env.example
└── Wally-1925-product-feed.xml
```

I file `.xml` sono esclusi dalla repository tramite `.gitignore`.

---

# 6. Imposta il file XML da convertire

Apri:

```text
convert_xml_to_json.js
```

Trova la riga che legge il file XML:

```javascript
const xml = await readFile(
  new URL('./NOME_FILE.xml', import.meta.url),
  'utf8'
);
```

Sostituisci:

```text
NOME_FILE.xml
```

con il nome esatto del file appena scaricato.

Esempio:

```javascript
new URL('./Wally-1925-product-feed.xml', import.meta.url)
```

---

# 7. Converti XML → JSON

Dal terminale esegui:

```bash
npm run convert
```

Lo script genera automaticamente:

```text
real_products.json
```

Questo è il file utilizzato successivamente dallo script principale.

`real_products.json` è generato localmente ed è escluso dalla repository tramite `.gitignore`.

---

# 8. Controlla il JSON

Verifica che:

```text
real_products.json
```

sia stato creato correttamente.

Durante la conversione vengono applicate automaticamente alcune regole.

## SKU e MPN

L'`id` XML viene utilizzato come SKU e come MPN.

Esempio:

```json
"id": "AZGXWGSS"
```

produce:

```json
"mpn": "AZGXWGSS"
```

---

## IVA

Ogni prodotto riceve:

```json
"tax_rate": "22"
```

---

## Titolo

Il brand viene aggiunto automaticamente alla fine del titolo.

Da:

```json
"title": "Brezza di mare",
"brand": "Wally 1925"
```

a:

```json
"title": "Brezza di mare - Wally 1925"
```

---

# 9. Primo test — Nessuna scrittura su Base.com

Prima di effettuare un'importazione reale è consigliato utilizzare:

```env
TEST_MODE=true
DRY_RUN=true
```

Avvia lo script:

```bash
npm start
```

In questa configurazione:

```text
1 prodotto
    ↓
normalizzazione
    ↓
controllo SKU
    ↓
creazione payload
    ↓
NESSUNA scrittura su Base.com
```

Controlla che non vengano mostrati errori.

---

# 10. Secondo test — Importazione di un prodotto

Se il test precedente è corretto, modifica `.env`:

```env
TEST_MODE=true
DRY_RUN=false
```

Poi:

```bash
npm start
```

In questo modo viene processato realmente un solo prodotto.

Il riepilogo sarà simile a:

```text
Prodotti letti: 157
Prodotti selezionati: 1
Prodotti processati: 1
Importati: 1
Simulati: 0
Errori: 0
```

Il numero di prodotti letti varia in base al catalogo.

Dopo il test controlla il prodotto direttamente su Base.com.

Verifica almeno:

```text
Titolo
SKU
EAN
Prezzo
Peso
Descrizione
Immagine
```

---

# 11. Importazione completa

Quando il test sul singolo prodotto è corretto, modifica `.env`:

```env
TEST_MODE=false
DRY_RUN=false
```

Poi esegui:

```bash
npm start
```

Lo script processerà tutti i prodotti presenti in:

```text
real_products.json
```

---

# Controllo duplicati

Prima di creare un prodotto, lo script controlla se lo stesso SKU è già presente nell'inventory Base.com selezionato.

Flusso:

```text
Prodotto
    ↓
SKU
    ↓
Ricerca su Base.com
    ↓
SKU presente?
├── SÌ → SKIPPED
└── NO → IMPORT
```

Se lo SKU esiste:

```text
SKIPPED
```

Il prodotto non viene creato nuovamente.

Se lo SKU non esiste, viene effettuata normalmente l'importazione.

Il controllo viene effettuato esclusivamente nell'inventory specificato in:

```env
BASE_INVENTORY_ID=
```

Questo permette di rilanciare lo script senza creare duplicati dello stesso SKU.

---

# Stati principali

## `SUCCESS`

Il prodotto è stato creato correttamente su Base.com.

## `SKIPPED`

Il prodotto possiede uno SKU già presente nell'inventory selezionato.

## `ERROR`

Si è verificato un errore durante elaborazione, controllo o invio.

L'errore di un singolo prodotto non blocca necessariamente l'elaborazione degli altri.

## `DRY_RUN`

Il prodotto è stato controllato e il payload è stato generato, ma non è stato inviato a Base.com.

---

# Configurazioni rapide

## Controlla 1 prodotto senza importare

```env
TEST_MODE=true
DRY_RUN=true
```

## Importa realmente 1 prodotto

```env
TEST_MODE=true
DRY_RUN=false
```

## Controlla tutto il catalogo senza importare

```env
TEST_MODE=false
DRY_RUN=true
```

## Importa realmente tutto il catalogo

```env
TEST_MODE=false
DRY_RUN=false
```

---

# Comandi principali

## Installazione dipendenze

```bash
npm install
```

## Conversione XML → JSON

```bash
npm run convert
```

## Avvio importazione

```bash
npm start
```

## Versione Node.js

```bash
node -v
```

## Versione npm

```bash
npm -v
```

---

# Procedura rapida completa

Per un nuovo utilizzo del progetto:

```text
1. Apri il progetto
        ↓
2. npm install
        ↓
3. Copia .env.example → .env
        ↓
4. Configura token e inventory
        ↓
5. Scarica XML da Vudoo
        ↓
6. Imposta il nome XML nel convertitore
        ↓
7. npm run convert
        ↓
8. TEST_MODE=true + DRY_RUN=true
        ↓
9. npm start
        ↓
10. TEST_MODE=true + DRY_RUN=false
        ↓
11. npm start
        ↓
12. Controlla il prodotto su Base.com
        ↓
13. TEST_MODE=false + DRY_RUN=false
        ↓
14. npm start
```

---

# Sviluppi futuri

Gli sviluppi, le funzionalità pianificate e gli obiettivi futuri del progetto sono raccolti in:

[`ROADMAP.md`](./ROADMAP.md)