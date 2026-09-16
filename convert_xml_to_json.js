import { convertXmlToJson } from './src/converter.js';

convertXmlToJson().catch(error => {
  console.error(`ERROR conversione XML: ${error.message}`);
  process.exitCode = 1;
});
