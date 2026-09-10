# Manuale operativo — Importazione catalogo Vudoo → Base.com

Questo script permette di importare un catalogo prodotti da Vudoo a Base.com.

Flusso attuale:

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
```

---

## 1. Requisiti

Sul PC devono essere installati:

```text
Node.js
npm
VS Code
```

Verifica dal terminale:

```bash
node -v
npm -v
```

Se entrambi restituiscono una versione, puoi procedere.

---

## 2. Apri il progetto

Apri la cartella del progetto con VS Code:

```text
File → Open Folder
```

Poi apri il terminale integrato.

---

# Preparazione catalogo

## 3. Scarica il catalogo da Vudoo

Dal Panel Vudoo scarica il catalogo prodotti in formato:

```text
Google XML
```

Il file avrà estensione:

```text
.xml
```

Copia il file XML nella cartella del progetto.

---

## 4. Imposta il file XML da convertire

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

# Conversione XML → JSON

## 5. Avvia la conversione

Dal terminale:

```bash
npm run convert
```

Lo script genera:

```text
real_products.json
```

Questo è il file che verrà letto dallo script principale.

---

## 6. Controlla il JSON

Verifica che:

```text
real_products.json
```

sia stato creato correttamente.

Durante la conversione vengono applicate automaticamente alcune regole.

### SKU

L'`id` XML viene utilizzato come SKU.

Esempio:

```json
"id": "AZGXWGSS"
```

e viene utilizzato anche come MPN:

```json
"mpn": "AZGXWGSS"
```

### IVA

Ogni prodotto riceve:

```json
"tax_rate": "22"
```

### Titolo

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

# Configurazione `.env`

## 7. Crea il file `.env`

Nel progetto è presente:

```text
.env.example
```

Questo file contiene i nomi delle variabili necessarie allo script, ma **non contiene credenziali reali**.

Il contenuto sarà simile a:

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

Il file `.env` sarà quindi quello utilizzato realmente dallo script.

---

## 8. Configura `.env`

Apri:

```text
.env
```

e inserisci i valori necessari.

Esempio:

```env
BASE_API_TOKEN=INSERISCI_TOKEN_BASE
BASE_INVENTORY_ID=115966
BASE_WAREHOUSE_ID=
TEST_MODE=true
DRY_RUN=true
```

### `BASE_API_TOKEN`

Token API utilizzato per comunicare con Base.com.

```env
BASE_API_TOKEN=INSERISCI_TOKEN_BASE
```

**Non condividere e non caricare il token su GitHub.**

---

### Token API Base.com

Ogni sviluppatore che utilizza lo script deve configurare nel proprio file `.env` un token API Base.com valido:

```env
BASE_API_TOKEN=INSERISCI_TOKEN_BASE
```

Il token non deve essere salvato nella repository e non deve essere condiviso dentro file versionati.

Il file `.env` è escluso da Git tramite `.gitignore`.

È consigliato che ogni collaboratore utilizzi il proprio token API personale, se possibile.

In questo modo:

```text
Collaboratore A → proprio .env → proprio token
Collaboratore B → proprio .env → proprio token
Collaboratore C → proprio .env → proprio token
```

Se un token viene accidentalmente pubblicato, condiviso o salvato nella cronologia Git, deve essere considerato non più sicuro e va sostituito/revocato.

---

### `BASE_INVENTORY_ID`

ID dell'inventory Base.com nel quale devono essere importati i prodotti.

```env
BASE_INVENTORY_ID=115966
```

Per i test può essere utilizzato l'inventory Wally di test:

```env
BASE_INVENTORY_ID=115966
```

Lo script verifica l'inventory tramite API e recupera automaticamente il gruppo prezzi associato.

---

### `BASE_WAREHOUSE_ID`

Identifica il warehouse Base.com da utilizzare quando è necessario gestire quantità e stock.

```env
BASE_WAREHOUSE_ID=
```

Se il catalogo non contiene quantità numeriche di stock, questa configurazione può non essere necessaria.

---

### `TEST_MODE`

Decide quanti prodotti vengono processati.

```env
TEST_MODE=true
```

→ processa solamente il primo prodotto.

```env
TEST_MODE=false
```

→ processa tutti i prodotti.

---

### `DRY_RUN`

Decide se lo script deve scrivere realmente su Base.com.

```env
DRY_RUN=true
```

→ esegue i controlli e costruisce il payload, ma **non crea prodotti**.

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

invece deve rimanere nella repository, perché permette agli altri sviluppatori di sapere quali variabili devono configurare.

In breve:

```text
.env.example → GitHub ✅
.env         → GitHub ❌
```

---

# Procedura consigliata

## 9. Test senza scrivere su Base.com

Imposta:

```env
TEST_MODE=true
DRY_RUN=true
```

Poi:

```bash
npm start
```

Controlla che non ci siano errori.

In questa modalità viene processato solamente un prodotto e non viene scritto nulla su Base.com.

---

## 10. Test con un prodotto reale

Se il test precedente è corretto:

```env
TEST_MODE=true
DRY_RUN=false
```

Poi:

```bash
npm start
```

Dovresti ottenere qualcosa di simile:

```text
Prodotti letti: 157
Prodotti selezionati: 1
Prodotti processati: 1
Importati: 1
Simulati: 0
Errori: 0
```

Il numero dei prodotti letti dipende dal catalogo utilizzato.

Controlla poi il prodotto dentro Base.com.

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

# Importazione completa

## 11. Importa tutto il catalogo

Quando il test è corretto:

```env
TEST_MODE=false
DRY_RUN=false
```

Poi:

```bash
npm start
```

Lo script elaborerà tutti i prodotti presenti in:

```text
real_products.json
```

---

# Controllo duplicati

Prima di creare un prodotto, lo script controlla se lo SKU è già presente nell'inventory selezionato.

Se lo SKU esiste:

```text
SKIPPED
```

Il prodotto non viene creato nuovamente.

Se lo SKU non esiste:

```text
SUCCESS
```

il prodotto viene importato.

Questo permette di rilanciare lo script senza creare duplicati dello stesso SKU.

Il controllo viene effettuato solamente all'interno dell'inventory specificato in:

```env
BASE_INVENTORY_ID=
```

---

# Stati possibili

```text
SUCCESS
```

Prodotto creato correttamente.

```text
SKIPPED
```

Prodotto già presente nell'inventory.

```text
ERROR
```

Errore durante elaborazione o invio.

```text
DRY_RUN
```

Prodotto controllato ma non inviato.

---

# Configurazioni rapide

### Controlla 1 prodotto senza importare

```env
TEST_MODE=true
DRY_RUN=true
```

### Importa 1 prodotto

```env
TEST_MODE=true
DRY_RUN=false
```

### Controlla tutto il catalogo senza importare

```env
TEST_MODE=false
DRY_RUN=true
```

### Importa tutto il catalogo

```env
TEST_MODE=false
DRY_RUN=false
```

---

# Comandi principali

Convertire XML in JSON:

```bash
npm run convert
```

Avviare lo script principale:

```bash
npm start
```

Controllare Node:

```bash
node -v
```

Controllare npm:

```bash
npm -v
```

---

# Upgrade futuri

## Connessione diretta alle API Vudoo

Eliminare il passaggio manuale:

```text
XML
↓
JSON
```

e utilizzare:

```text
Vudoo API
↓
GET
↓
JSON
↓
script
↓
Base.com
```

---

## Aggiornamento prodotti

Attualmente:

```text
SKU presente
→ SKIPPED
```

In futuro:

```text
SKU presente
↓
confronto dati
↓
dati uguali → SKIPPED
dati diversi → UPDATE
```

---

## Creazione automatica categorie

Utilizzare:

```text
product_type
```

per verificare o creare automaticamente le categorie Base.com.

---

## Creazione automatica produttori

Utilizzare:

```text
brand
```

per verificare o creare automaticamente il produttore su Base.com.

---

## Sincronizzazione stock

Quando saranno disponibili quantità reali tramite Vudoo:

```text
Stock Vudoo
↓
script
↓
Warehouse Base.com
```

---

## Obiettivo finale

```text
Database Vudoo
      ↓
API Vudoo
      ↓
script Node.js
      ↓
CREATE / UPDATE / SKIP
      ↓
Base.com
```

In questo modo il processo potrà diventare completamente automatico, senza download e conversione manuale dei file XML.