import { syncManufacturers } from './src/productor.js';

syncManufacturers().catch(err => console.error('Errore:', err.message));
