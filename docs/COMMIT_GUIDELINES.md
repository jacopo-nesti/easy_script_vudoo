# Linee guida per i commit

I messaggi di commit devono spiegare **in modo chiaro cosa è stato modificato**.

## Evitare commit generici

Non usare messaggi come:

```text
New commit
Update
Changes
Fix
Test
Commit
Modified files
```

Questi messaggi non spiegano nulla e rendono difficile capire la storia del progetto.

## Scrivere commit descrittivi

Preferibilmente usare l'inglese e descrivere l'azione eseguita.

Esempi corretti:

```text
Add duplicate SKU check
Fix product update logic
Add automatic manufacturer handling
Improve product validation
Update Base.com payload
Remove unused files
Add XML to JSON converter
Update project documentation
Stop tracking node_modules
Fix tax rate mapping
```

## Regola semplice

Il commit dovrebbe completare mentalmente la frase:

```text
This commit will...
```

Esempio:

```text
This commit will add duplicate SKU check
```

quindi:

```text
Add duplicate SKU check
```

## Formato consigliato

```text
Verbo + cosa è stato modificato
```

Usare verbi come:

```text
Add
Fix
Update
Remove
Improve
Refactor
Rename
```

## Un commit = una modifica logica

Quando possibile, evitare di mettere nello stesso commit modifiche completamente diverse.

Meglio:

```text
Add manufacturer mapping
```

e successivamente:

```text
Update project documentation
```

invece di:

```text
Various changes
```

## Prima del commit

Controllare sempre:

```bash
git status
git diff
```

Poi:

```bash
git add .
git commit -m "Add automatic manufacturer handling"
```

L'obiettivo è che, leggendo la history Git, sia possibile capire velocemente **cosa è stato fatto e perché**.