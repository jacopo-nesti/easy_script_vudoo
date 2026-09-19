const BASE_API_URL = 'https://api.baselinker.com/connector.php';
const scenario = process.env.TEST_BASE_SCENARIO;

function baseResponse(data) {
  return {
    ok: true,
    status: 200,
    headers: {
      get() {
        return null;
      },
    },
    async json() {
      return { status: 'SUCCESS', ...data };
    },
  };
}

globalThis.fetch = async (url, request = {}) => {
  if (url !== BASE_API_URL) {
    throw new Error(`Richiesta esterna non prevista nel test: ${url}`);
  }

  const method = request.body?.get('method');

  if (!method?.startsWith('get')) {
    throw new Error(`Scrittura Base.com bloccata nel test: ${method ?? 'metodo sconosciuto'}`);
  }

  if (scenario === 'preflight-error' && method === 'getInventories') {
    return baseResponse({
      status: 'ERROR',
      error_code: 'TEST_PREFLIGHT_ERROR',
      error_message: 'Errore preflight controllato dal test',
    });
  }

  if (scenario === 'import-error' && method === 'getInventoryManufacturers') {
    return baseResponse({
      status: 'ERROR',
      error_code: 'TEST_IMPORT_ERROR',
      error_message: 'Errore import controllato dal test',
    });
  }

  const responses = {
    getInventories: {
      inventories: [
        {
          inventory_id: 10,
          name: 'Inventory test',
          is_default: true,
          price_groups: [20],
          default_price_group: 20,
          warehouses: ['bl_30'],
        },
      ],
    },
    getInventoryPriceGroups: {
      price_groups: [
        {
          price_group_id: 20,
          name: 'Default',
          currency: 'EUR',
          is_default: true,
        },
      ],
    },
    getInventoryWarehouses: {
      warehouses: [
        {
          warehouse_id: 30,
          name: 'Warehouse test',
          warehouse_type: 'bl',
        },
      ],
    },
    getInventoryManufacturers: {
      manufacturers: [{ manufacturer_id: 40, name: 'Marca' }],
    },
    getInventoryCategories: {
      categories: [],
    },
    getInventoryProductsList: {
      products: {},
    },
    getInventoryProductsData: {
      products: {},
    },
  };

  if (!(method in responses)) {
    throw new Error(`Lettura Base.com non prevista nel test: ${method}`);
  }

  return baseResponse(responses[method]);
};
