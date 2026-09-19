# Procedura standard di lavoro

Da questo momento il flusso di lavoro standard del progetto è il seguente.

## 1. Scegliere una Issue

Prima di iniziare una modifica, scegliere una Issue aperta su GitHub.

Leggere bene:

- obiettivo;
- comportamento atteso;
- attività da fare.

Se necessario, assegnarsi la Issue per evitare che due persone lavorino sulla stessa cosa.

---

## 2. Creare un branch dalla Issue

Dalla Issue:

```text
Issue
→ Create branch
```

Il branch deve partire da:

```text
main
```

Non si lavora direttamente su `main`.

---

## 3. Portare il branch in locale

Dal terminale:

```bash
git fetch origin
git switch nome-branch
```

Se necessario:

```bash
git switch --track origin/nome-branch
```

Controllare sempre di essere sul branch corretto prima di modificare il codice:

```bash
git branch
```

---

## 4. Lavorare solo sul proprio branch

Tutte le modifiche devono essere fatte sul branch della Issue.

È possibile:

- modificare file;
- aggiungere file;
- eliminare codice;
- aggiungere funzioni;
- installare dipendenze se realmente necessarie.

Non modificare `main`.

Non fare push diretto su `main`.

---

## 5. Testare il codice e la configurazione

Prima di considerare il lavoro completato, il codice deve essere testato.

Eseguire la diagnostica dell'ambiente quando la modifica coinvolge configurazione o collegamento Base.com:

```bash
npm run check
```

Eseguire sempre la suite automatica:

```bash
npm test
```

Non basta verificare un solo caso.

Bisogna provare:

- caso normale;
- casi limite;
- dati mancanti;
- dati già presenti;
- più prodotti;
- combinazioni diverse;
- eventuali errori previsti.

La feature deve funzionare senza rompere quello che funzionava prima.

---

## 6. Controllare cosa è stato modificato

Prima del commit:

```bash
git status
```

e:

```bash
git diff
```

Controllare che non siano stati aggiunti file inutili o generati accidentalmente.

In particolare evitare:

```text
.env
node_modules/
file XML
file CSV
real_products.json
file temporanei
file vuoti non necessari
```

Modifiche a `package.json` e `package-lock.json` devono avere una motivazione precisa.

---

## 7. Fare commit

Quando il lavoro è pronto:

```bash
git add .
git commit -m "Descrizione chiara della modifica"
```

Il messaggio deve spiegare cosa è stato fatto.

---

## 8. Aggiornarsi con il main

Prima di aprire la Pull Request bisogna verificare se `main` è cambiato.

```bash
git fetch origin
git switch main
git pull origin main
```

Poi tornare sul proprio branch:

```bash
git switch nome-branch
```

e integrare il nuovo `main`:

```bash
git merge main
```

Se ci sono conflitti, vanno risolti prima di continuare.

Le modifiche personali non vengono automaticamente eliminate: Git prova a integrare entrambi i lavori.

---

## 9. Testare di nuovo

Dopo il merge con `main`, eseguire nuovamente tutti i test.

Questo passaggio è obbligatorio perché il branch ora contiene:

```text
proprio lavoro
+
ultime modifiche presenti su main
```

Il fatto che il codice funzionasse prima non garantisce che funzioni ancora dopo il merge.

---

## 10. Push del branch

Quando tutto funziona:

```bash
git push
```

Il push deve andare esclusivamente sul proprio branch.

Mai direttamente su `main`.

---

## 11. Aprire una Pull Request

Su GitHub:

```text
Pull Requests
→ New Pull Request
```

Impostare:

```text
base: main
compare: proprio branch
```

Nella Pull Request indicare almeno:

- cosa è stato modificato;
- perché;
- quali test sono stati eseguiti;
- eventuali problemi ancora presenti;
- Issue collegata.

Esempio:

```text
Closes #4
```

---

## 12. Aspettare la review

Una Pull Request non deve essere mergiata automaticamente da chi l'ha sviluppata.

Prima deve essere verificata da un altro membro del team.

La review deve controllare:

- modifiche ai file;
- logica;
- eventuali file inutili;
- dipendenze aggiunte;
- compatibilità con il resto del progetto;
- risultati dei test.

Se necessario, il reviewer può fare checkout del branch e testarlo in locale.

---

## 13. Merge su main

Solo quando:

```text
codice funzionante
+
test completati
+
review approvata
```

si può fare il merge della Pull Request su `main`.

`main` deve sempre rappresentare la versione stabile del progetto.

---

# Regola principale

```text
ISSUE
↓
BRANCH
↓
SVILUPPO
↓
TEST LOCALE E VERIFICA CONFIGURAZIONE
↓
AGGIORNAMENTO CON MAIN
↓
NUOVO TEST
↓
PUSH DEL BRANCH
↓
PULL REQUEST
↓
REVIEW
↓
MERGE SU MAIN
```

## Vietato

```text
lavorare direttamente su main
pushare direttamente su main
mergiare una PR senza review
mergiare codice non testato
aggiungere file inutili o generati
```

Se una modifica non è chiara, non è testata o non sappiamo spiegare perché serve, non entra in `main`.
