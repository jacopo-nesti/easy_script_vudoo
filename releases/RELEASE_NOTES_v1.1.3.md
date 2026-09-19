```md
# Release Notes — v1.1.3

**Vudoo Base Connector v1.1.3**

Questa release raccoglie i fix Critical/High emersi dalla review tecnica della v1.1.2 e consolida la base del progetto prima dell'integrazione diretta con l'API/Web Service Vudoo.

---

## Fix stock e deduplicazione

La deduplicazione dei prodotti utilizza ora lo stesso criterio della normalizzazione per determinare lo stock effettivo.

Comportamento:

- quantità numerica → mantenuta;
- quantità numerica in formato stringa → convertita;
- `quantity: 0` → mantenuta;
- quantità superiori a 10 → mantenute;
- quantità assente, `null` o vuota + `in stock` → fallback 10;
- quantità assente + `out of stock` → 0;
- disponibilità sconosciuta → stock omesso;
- quantità invalida → errore;
- quantità reale sempre prioritaria rispetto ad `availability`.

La deduplicazione confronta ora lo stock effettivo invece del solo valore sorgente di `quantity`.

Questo evita risultati dipendenti dall'ordine dei record e rileva correttamente conflitti tra duplicati con disponibilità discordante.

---

## CREATE incerte di categorie e produttori

È stata rafforzata la gestione delle scritture incerte causate da timeout o perdita della risposta API.

L'identità di categorie e produttori viene normalizzata tramite:

```text
trim
→ compressione degli spazi multipli
→ lowercase
```

La normalizzazione viene utilizzata esclusivamente per il confronto identitario.

Accenti, punteggiatura e altri caratteri significativi restano invariati.

### Produttori

Dopo una CREATE incerta:

- viene effettuata una rilettura read-only;
- nomi equivalenti per maiuscole/minuscole e spazi vengono riconosciuti;
- la mappa viene aggiornata con l'ID reale trovato;
- una variante equivalente del nome non provoca una seconda CREATE automatica;
- nomi realmente differenti restano distinti.

### Categorie

La riconciliazione considera:

- `inventory_id`;
- `parent_id`;
- nome normalizzato.

Categorie con lo stesso nome ma parent o inventory differenti restano quindi entità distinte.

In presenza di più categorie equivalenti sotto lo stesso parent, il sistema mantiene un comportamento prudente e non seleziona arbitrariamente un ID.

### Sicurezza delle scritture

Rimane invariata la filosofia di sicurezza del progetto:

- nessun retry cieco delle CREATE;
- riconciliazione tramite sole letture;
- esito non verificabile → stato uncertain;
- errori definitivi non trattati come scritture incerte;
- DRY_RUN invariato.

---

## Test CLI e sync

I test CLI e sync sono stati resi deterministici e indipendenti dall'ambiente locale.

Le vecchie verifiche potevano in alcuni casi risultare verdi senza eseguire realmente il workflow dichiarato.

La nuova suite utilizza:

- una directory temporanea indipendente per ogni test;
- fixture XML controllate;
- fixture JSON controllate;
- `.env` di test generato dinamicamente;
- `package.json` incluso nell'ambiente runtime della fixture;
- token esclusivamente fittizi;
- ambiente dei processi figli costruito tramite whitelist;
- mock dedicato per Base.com;
- pulizia automatica delle fixture al termine di ogni test.

Il mock Base.com:

- rifiuta URL esterni non previsti;
- rifiuta letture Base non previste;
- blocca qualsiasi metodo che non inizi con `get`;
- impedisce quindi qualsiasi scrittura reale durante i test.

---

## Timeout dei test

I timeout vengono ora utilizzati esclusivamente come limite massimo di sicurezza.

Se un processo non completa il workflow entro il tempo previsto:

- viene terminato;
- il test fallisce;
- viene mostrato l'output raccolto.

La terminazione forzata non viene più considerata un risultato valido.

---

## Test diretto di `sync.js`

La suite esegue realmente:

```bash
node sync.js
```

e verifica tre scenari distinti:

1. conversione → preflight → import completato;
2. errore durante il preflight → import non avviato;
3. preflight riuscito → import avviato e fallimento controllato nella fase prevista.

---

## Risultato test

Suite completa:

```text
121 passed
0 failed
0 skipped
```

Sono stati verificati inoltre:

- `git diff --check`;
- comportamento DRY_RUN;
- assenza di scritture reali verso Base.com;
- assenza di regressioni Critical/High nei tre fix introdotti;
- esecuzione reale dei workflow CLI e sync.

---

## Review finale

Dopo l'implementazione dei fix è stata eseguita una review mirata sui tre problemi Critical/High individuati nella v1.1.2.

Esito:

- deduplicazione stock / availability → corretta;
- CREATE incerta categorie / produttori → corretta;
- test CLI / sync → corretti;
- nessun problema Critical/High residuo individuato;
- working tree pulito;
- repository invariato durante la review.

---

## Stato del progetto

Con la v1.1.3 i problemi Critical/High emersi dalla review della v1.1.2 risultano chiusi.

Il progetto è ora pronto per iniziare la prossima fase:

**integrazione diretta con l'API/Web Service Vudoo**.

---

## Upgrade

Non sono richieste modifiche alla configurazione esistente.

Nessuna nuova dipendenza è stata aggiunta.
```