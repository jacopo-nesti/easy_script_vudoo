# ⚙️ Configurazione

Il comportamento dell'applicazione viene configurato tramite le variabili d'ambiente definite nel file `.env`. Usa `.env.example` come modello e copialo in `.env`: il file di esempio deve rimanere versionato e non deve contenere token reali.

## Variabili d'Ambiente Principali

* **`BASE_API_TOKEN`**: token di autenticazione Base.com obbligatorio;
* **`BASE_INVENTORY_ID`**: inventory da usare quando si desidera una selezione esplicita. Se assente, il progetto richiede un inventory predefinito identificabile in modo univoco;
* **`BASE_WAREHOUSE_ID`**: warehouse da usare per lo stock quando è necessaria una selezione esplicita. Il valore viene verificato rispetto all'inventory selezionato;
* **`DRY_RUN`**: con `true` blocca tutte le scritture verso Base.com;
* **`TEST_MODE`**: con `true` limita l'elaborazione al primo prodotto selezionato.

## Protezione delle API

Le seguenti impostazioni configurano le protezioni del client Base.com:

* **`BASE_API_WINDOW_MS`**: durata della finestra mobile;
* **`BASE_API_SAFE_LIMIT`**: numero massimo prudenziale di richieste nella finestra;
* **`BASE_API_SOFT_LIMIT`**: soglia dalla quale il client rallenta progressivamente;
* **`BASE_API_READ_ATTEMPTS`**: tentativi totali consentiti per una lettura temporaneamente fallita;
* **`BASE_API_RETRY_DELAY_MS`**: attesa iniziale tra i retry delle letture;
* **`BASE_API_RATE_LIMIT_DELAY_MS`**: pausa condivisa usata per rate limit reattivi quando non è disponibile un'attesa più lunga tramite `Retry-After`.

I valori presenti in `.env.example` sono impostazioni prudenziali interne e configurabili, non dichiarazioni delle quote ufficiali Base.com.

## Configurazione iniziale

```powershell
Copy-Item .env.example .env
```

Su macOS o Linux:

```bash
cp .env.example .env
```

Inserisci il token esclusivamente nel file locale `.env`. Per il primo controllo usa `DRY_RUN=true` e `TEST_MODE=true`.
