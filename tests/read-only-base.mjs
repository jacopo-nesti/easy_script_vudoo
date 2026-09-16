process.env.DRY_RUN = 'true';
process.env.TEST_MODE = 'true';
const fetchReadOnly = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const method = options?.body?.get('method');
  if (url !== 'https://api.baselinker.com/connector.php' || !method?.startsWith('get')) {
    throw new Error('Test di sola lettura: richiesta bloccata.');
  }
  return fetchReadOnly(url, options);
};
