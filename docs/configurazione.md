# ⚙️ Configurazione

Il comportamento dell'applicazione viene configurato tramite le variabili d'ambiente definite nel file `.env`. Puoi utilizzare il file `.env.example` come modello di partenza.

## Variabili d'Ambiente Principali

* `BASE_API_TOKEN`
* `DRY_RUN`
* `TEST_MODE`

### Dettaglio dei Parametri

* **`BASE_API_TOKEN`**: Token di autenticazione necessario per effettuare le chiamate alle API di Base.com.
* **`DRY_RUN`**: Flag per la gestione delle operazioni di scrittura. Impostando `DRY_RUN=true` vengono bloccate le scritture verso Base.com.
* **`TEST_MODE`**: Attiva o disattiva la modalità di test dell'applicazione.

### Note di Configurazione e Sicurezza

* Il file `.env.example` utilizza `DRY_RUN=true` come configurazione sicura predefinita.
* Il supporto opzionale a `BASE_INVENTORY_ID` è ancora presente nel codice ma non viene utilizzato nella configurazione corrente e sarà valutato separatamente.