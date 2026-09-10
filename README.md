# GUIDA

## Copia cartella progetto su desktop

## Installa node.js e npm

## Apri il progetto con VS code

## Scarica file catalogo prodotti in formato google (formato .xml) da panel vudoo

## Salva il file .xml dentro la cartella del progetto

## Apri file "convert_xml_to_json.js",  cerca la riga 26: const xml = await readFile(new URL('./QUA INSERISCI IL NOME DEL FILE.xml

## Dal terminale di vs code scrivi "node convert_xml_to_json.js" e verifica che lo script abbia generato un file chiamato real_products.json

## Apri il file .env, se necessario cambia il BASE_INVENTORY_ID con l'id dell'inventario su base.com oppure utilizza "115966" per l'inventario di test

## Sempre dentro il file .env, assicurati che TEST_MODE=true e DRY_RUN=false

## Dal terminale di vs code scrivi "npm start", nell'output del terminale dovresti vedere: 
- Prodotti letti: "numero di prodotti presenti nel catalogo usato"
- Prodotti selezionati: 1
- Prodotti processati: 1
- Importati: 1
- Simulati: 0
- Errori: 0

## Se segna prodotti importati: 1, torna sul file .env e assicurati che TEST_MODE=false e DRY_RUN=false

## Dal terminale di vs code scrivi "npm start" per lanciare lo script --> in questo modo verranno trasferiti i prodotti dal tuo catalogo a base.com