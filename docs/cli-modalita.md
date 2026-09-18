# Modalità della CLI e Comandi Disponibili

Questo documento descrive le modalità di esecuzione e i comandi disponibili per la gestione, la sincronizzazione e il testing del progetto **easy_script_vudoo**.

---

## 1. Menu Principale

### `npm start`
Apre la CLI interattiva con le seguenti opzioni:

1. Conversione XML → JSON;
2. Sincronizzazione produttori;
3. Importazione / aggiornamento prodotti;
4. Flusso completo;
5. Test automatici;
6. Uscita.

---

## 2. Importazione Diretta

### `npm run import`
Esegue direttamente l'importazione / sincronizzazione dei prodotti verso Base.com.

---

## 3. Conversione

### `npm run convert`
Esegue soltanto la conversione XML → JSON.

---

## 4. Produttori

### `npm run productor`
Esegue la sincronizzazione separata dei produttori.

---

## 5. Flusso Completo

### `npm run sync`
Esegue:
`XML → JSON → importazione Base.com`

> **Nota**: Il comando `productor` non fa parte del `sync` perché l'importazione gestisce già i produttori mancanti.

---

## 6. Test

### `npm test`
Esegue la suite automatica.

Attualmente la suite contiene **53 test**.