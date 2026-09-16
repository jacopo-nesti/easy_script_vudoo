						
	import { getCategories } from './categories.js';					
						
	async function run() {					
	console.log("Inizio connessione a Base.com...");					
	try {					
	const categories = await getCategories();					
	console.log("Categorie ricevute con successo:", categories);					
	} catch (error) {					
	console.error("Errore durante la chiamata:", error);					
	}					
	}					
						
	run();					
						
						