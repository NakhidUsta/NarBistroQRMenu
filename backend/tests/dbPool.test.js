// QA K (yük testi) tapıntısı F26: config/db.js bağlantı hovuzunun ölçüsünü təyin etmirdi (mssql/tarn defolt max 10).
// 25+ paralel sifariş (hər biri tranzaksiya ərzində bir bağlantı tutur) hovuzu tükədib 30san sonra "operation timed out"
// ilə 500 qaytarırdı (canlı yük testində: 25/25 və 50/50 paralel sifariş uğursuz oldu). İndi hovuz ölçüsü açıq təyin olunur.
describe('config/db.js: bağlantı hovuzu', () => {
  const ORIGINAL_ENV = process.env;
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
  });
  afterAll(() => { process.env = ORIGINAL_ENV; });

  it('mssql ConnectionPool-a defolt (10-dan çox) pool.max ötürülür — 25+ paralel sifariş tükənməsin', () => {
    const mssql = require('mssql');
    const spy = jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect: () => new Promise(() => {}) }));
    require('../src/config/db');
    expect(spy).toHaveBeenCalledTimes(1);
    const config = spy.mock.calls[0][0];
    expect(config.pool).toBeDefined();
    expect(config.pool.max).toBeGreaterThanOrEqual(25);
    expect(config.pool.acquireTimeoutMillis).toBeLessThanOrEqual(20000); // asılı qalmasın — tez uğursuz olsun
    spy.mockRestore();
  });

  it('DB_POOL_MAX mühit dəyişəni ilə tənzimlənə bilir', () => {
    process.env.DB_POOL_MAX = '77';
    const mssql = require('mssql');
    const spy = jest.spyOn(mssql, 'ConnectionPool').mockImplementation(() => ({ connect: () => new Promise(() => {}) }));
    require('../src/config/db');
    expect(spy.mock.calls[0][0].pool.max).toBe(77);
    spy.mockRestore();
  });
});
