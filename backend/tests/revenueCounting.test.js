// Gəlir/hesabat sorğuları: ödənişi yarımçıq (PENDING), uğursuz (FAILED) və geri qaytarılmış (REFUNDED) onlayn sifarişlər
// gəlir kimi SAYILMAMALIDIR (onlar üçün pul alınmayıb və ya qaytarılıb). SQL mətnini tutub yoxlayırıq.
const queries = [];
jest.mock('../src/config/db', () => {
  const actual = jest.requireActual('mssql');
  const request = () => {
    const req = {
      input: () => req,
      query: async (text) => {
        queries.push(text);
        return { recordset: [{ order_count: 0, total_sales: 0, avg_check: 0, cancelled_count: 0, total_discount: 0, active_tables: 0 }], rowsAffected: [0] };
      },
    };
    return req;
  };
  return { sql: actual, poolPromise: Promise.resolve({ request }) };
});

const adminRepository = require('../src/repositories/adminRepository');
const insightRepository = require('../src/repositories/insightRepository');

const range = { from: '2026-09-01', to: '2026-09-30' };
const EXCLUDES_UNPAID_ONLINE = /NOT \(o\.payment_method = N'ONLINE' AND o\.payment_status IN \(N'PENDING', N'FAILED', N'REFUNDED'\)\)/;

beforeEach(() => {
  queries.length = 0;
});

describe('gəlir hesablamaları ödənilməmiş/qaytarılmış onlayn sifarişləri saymır', () => {
  it('COUNTED şərti ləğv olunmuşları və yarımçıq/uğursuz/qaytarılmış onlayn sifarişləri xaric edir', () => {
    expect(adminRepository.COUNTED).toContain("o.status <> 'CANCELLED'");
    expect(adminRepository.COUNTED).toMatch(EXCLUDES_UNPAID_ONLINE);
  });

  it('Dashboard: xülasə, gündəlik satış, saatlıq, ən çox/az satılan, kateqoriya — hamısı şərti tətbiq edir', async () => {
    await adminRepository.getSummary(range);
    await adminRepository.getDailySales(range);
    await adminRepository.getHourly(range);
    await adminRepository.getTopProducts(range);
    await adminRepository.getLeastProducts(range);
    await adminRepository.getCategorySales(range);
    expect(queries.length).toBeGreaterThanOrEqual(6);
    for (const q of queries) expect(q).toMatch(EXCLUDES_UNPAID_ONLINE);
  });

  it('ləğv sayı (cancelled_count) dəyişməyib, yalnız CANCELLED-ləri sayır', async () => {
    await adminRepository.getSummary(range);
    expect(queries[0]).toContain("CASE WHEN o.status = 'CANCELLED' THEN 1 ELSE 0 END");
  });

  it('müştəri xərcləməsi və CSV məhsul satışları da şərti tətbiq edir', async () => {
    await insightRepository.getCustomers({});
    await insightRepository.exportProductSales(range);
    expect(queries).toHaveLength(2);
    for (const q of queries) expect(q).toMatch(EXCLUDES_UNPAID_ONLINE);
  });

  it('masa "məşğul" sayılmasında ödənişi gözlənilən onlayn sifariş yoxdur', async () => {
    await adminRepository.getActiveTablesCount();
    expect(queries[0]).toMatch(/NOT \(payment_method = N'ONLINE' AND payment_status IN \(N'PENDING', N'FAILED'\)\)/);
  });
});
