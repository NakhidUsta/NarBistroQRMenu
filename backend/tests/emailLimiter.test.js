// Limit bu faylda ayrıca aşağı salınır (setupEnv-də 1000-dir): 3 sorğudan sonra 429 gözlənilir
process.env.EMAIL_FLOW_LIMIT = '3';

const request = require('supertest');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/emailTokenRepository');
jest.mock('../src/services/mailService');
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn() }));

const mail = require('../src/services/mailService');
const app = require('../src/app');

describe('e-poçt axını IP limiti', () => {
  it('forgot-password 3 sorğudan sonra 429 qaytarır (spam məktub və token təxmininə qarşı)', async () => {
    mail.isConfigured.mockReturnValue(false);
    const post = () => request(app).post('/api/auth/forgot-password').send({ email: 'a@b.co' });
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    expect((await post()).status).toBe(200);
    const blocked = await post();
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toContain('Çox sayda');
  });

  it('limit reset-password və verify-email üçün də ortaqdır (token təxminini də məhdudlaşdırır)', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ token: 'x', new_password: 'YeniSifre123' });
    expect(res.status).toBe(429);
  });
});
