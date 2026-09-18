# Roadmap — Vudoo → Base.com

Sviluppi e miglioramenti previsti per il progetto.

## Stato attuale

Il flusso attuale (versione 1.1.0) permette di:

```text
Vudoo XML
    ↓
Conversione JSON
    ↓
Preflight Check (Validazione ambiente e inventory)
    ↓
Sincronizzazione Produttori e Categorie automatiche
    ↓
Controllo SKU e Confronto dati (Create / Update / Skip)
    ↓
Importazione / Aggiornamento tramite API Base.com
```
Sono già disponibili:

*   TEST\_MODE per elaborare un solo prodotto;
    
*   DRY\_RUN per simulare l'importazione;
    
*   Interfaccia CLI interattiva a menu;
    
*   Controlli preliminari Preflight per bloccare errori di configurazione;
    
*   Selezione e verifica dell'inventory Base.com;
    
*   Recupero automatico del gruppo prezzi;
    
*   **Gestione automatica dei produttori** (productor.js);
    
*   **Gestione automatica delle categorie** con mantenimento della gerarchia;
    
*   **Aggiornamento dei prodotti esistenti** (confronto dati e UPDATE su SKU già presenti);
    
*   Controllo degli SKU e gestione degli errori senza interrompere l'intero catalogo.

---

# Obiettivi

## 1. Connessione diretta alle API Vudoo

Sostituire il download e la conversione manuale del file XML con una chiamata diretta alle API Vudoo.

```text
Vudoo API
    ↓
GET prodotti
    ↓
JSON
    ↓
Normalizzazione
    ↓
Base.com
```

In questo modo `real_products.json` potrà rimanere principalmente come strumento di test o di fallback.

---

## 2. Aggiornamento dei prodotti esistenti

Attualmente:

```text
SKU già presente
→ SKIPPED
```

Obiettivo:

```text
SKU già presente
        ↓
Confronto dati
        ↓
    ┌───┴────┐
    ↓        ↓
 Uguali   Modificati
    ↓        ↓
 SKIPPED   UPDATE
```

Possibili dati da sincronizzare:

- prezzo;
- titolo;
- descrizione;
- EAN;
- peso;
- immagini;
- altri dati prodotto.

---

## 3. Gestione automatica delle categorie

Utilizzare `product_type` del catalogo per individuare la categoria corretta su Base.com.

Se la categoria non esiste, crearla automaticamente mantenendo anche eventuali gerarchie.

Esempio:

```text
Casa e Giardino
└── Essenze Ambiente
    └── Profumatori Bastoncini
```

---

## 4. Gestione automatica dei produttori

Utilizzare il campo:

```text
brand
```

per:

```text
controllare produttore
        ↓
esiste?
├── sì → utilizza manufacturer_id
└── no → crea produttore
```

---

## 5. Sincronizzazione stock

Quando Vudoo renderà disponibili quantità numeriche affidabili:

```text
Stock Vudoo
    ↓
Warehouse Base.com
    ↓
Aggiornamento quantità
```

Non ricavare quantità artificialmente dal semplice valore `in stock`.

---

## 6. Miglioramento validazione prodotti

Aggiungere ulteriori controlli prima dell'invio verso Base.com per individuare dati mancanti o non validi.

Esempi:

*   SKU mancante;
    
*   prezzo non valido;
    
*   EAN non valido;
    
*   URL immagine non valido;
    
*   peso non valido;
    
*   campi obbligatori mancanti.


Il prodotto problematico dovrà essere segnalato senza bloccare gli altri.

---

## 7. Report finale avanzato

Rendere più completo il riepilogo dell'esecuzione.

Esempio:

```text
Prodotti letti: 157
Creati: 140
Aggiornati: 5
Già presenti: 10
Errori: 2
```

---

# Obiettivo finale

Trasformare lo script da semplice importer a connettore di sincronizzazione:

```text
Database Vudoo
      ↓
API Vudoo
      ↓
Node.js
      ↓
Normalizzazione
      ↓
Confronto con Base.com
      ↓
CREATE / UPDATE / SKIP
      ↓
Base.com
```

L'obiettivo è ridurre progressivamente gli interventi manuali e mantenere sincronizzati i cataloghi Vudoo e Base.com.

## Limitazioni Note e Issue Aperte (v1.1.0)

Durante i test e l'utilizzo della versione `v1.1.0` sono emerse alcune limitazioni strutturali e architetturali che verranno affrontate nei prossimi rilasci:

* **Rate Limit API Base.com:** Durante l'importazione massiva dell'intero catalogo è stato concretamente raggiunto il limite di richieste consentite dalle API di Base.com. È necessario implementare logiche di limitazione della velocità (*rate limiting/throttling*) e di attesa/ripresa (*backoff*) nel client delle chiamate.
* **Esiti incerti delle scritture:** Gestione dei riscontri asincroni o parziali restituiti dalle API in caso di carichi elevati.
* **Sincronizzazione stock:** Attualmente disattivata o basata su logiche preliminari in attesa di dati numerici stabili dal fornitore.
* **Gestione immagini:** Ottimizzazione del caricamento e del linking delle risorse multimediali remote.
* **Connessione diretta API Vudoo:** Sostituzione dell'attuale tracciato XML statico con chiamate live dirette al gestionale Vudoo.
* **Cleanup dei file legacy:** Pulizia e rimozione programmata dei file di transito locali (es. dump intermedi non necessari).