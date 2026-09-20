// QA F5: HSTS (production), CSP (API: default-src 'none'; HTML: inline splash skripti hash ilə), Permissions-Policy
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const request = require('supertest');

jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({ request: () => ({ query: async () => ({}) }) }) }));

const { securityHeaders, buildPageCsp, inlineScriptHashes, API_CSP } = require('../src/middleware/securityHeaders');
const app = require('../src/app');

const sha = (s) => `'sha256-${crypto.createHash('sha256').update(s, 'utf8').digest('base64')}'`;

describe('API cavabları', () => {
  it('bütün /api cavabları CSP default-src none, nosniff, X-Frame-Options, Permissions-Policy daşıyır (404 də)', async () => {
    for (const url of ['/api/health', '/api/nonexistent']) {
      const res = await request(app).get(url);
      expect(res.headers['content-security-policy']).toBe(API_CSP);
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-frame-options']).toBe('DENY');
      expect(res.headers['permissions-policy']).toContain('camera=()');
      expect(res.headers['x-powered-by']).toBeUndefined();
    }
  });

  it('HSTS yalnız production-da göndərilir', () => {
    const run = (env) => {
      const prev = process.env.NODE_ENV;
      process.env.NODE_ENV = env;
      const headers = {};
      securityHeaders({ path: '/api/x' }, { setHeader: (k, v) => { headers[k] = v; } }, () => {});
      process.env.NODE_ENV = prev;
      return headers;
    };
    expect(run('production')['Strict-Transport-Security']).toMatch(/max-age=31536000/);
    expect(run('test')['Strict-Transport-Security']).toBeUndefined();
  });
});

describe('HTML səhifə CSP', () => {
  const html = '<html><head><script type="application/ld+json">{"a":1}</script></head><body><script>var x = 1;</script><script type="module" src="/assets/a.js"></script></body></html>';

  it('yalnız icra olunan inline skriptlər hash alır (JSON-LD və src-li skriptlər yox)', () => {
    expect(inlineScriptHashes(html)).toEqual([sha('var x = 1;')]);
  });

  it("script-src 'unsafe-inline' YOXDUR, hash var; framing, object, base-uri bağlıdır", () => {
    const csp = buildPageCsp(html, { NODE_ENV: 'test' });
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe(`script-src 'self' ${sha('var x = 1;')}`);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain('https://fonts.googleapis.com');
    expect(csp).toContain('https://fonts.gstatic.com');
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('production: upgrade-insecure-requests; PUBLIC_URL socket üçün wss ilə connect-src-yə əlavə olunur', () => {
    const csp = buildPageCsp(html, { NODE_ENV: 'production', PUBLIC_URL: 'https://menu.example.az/path' });
    expect(csp).toContain('upgrade-insecure-requests');
    expect(csp).toContain("connect-src 'self' https://menu.example.az wss://menu.example.az");
  });

  it('əsl frontend/index.html: splash skriptinin hash-i CSP-dədir və başqa icra olunan inline skript yoxdur', () => {
    const real = fs.readFileSync(path.join(__dirname, '..', '..', 'frontend', 'index.html'), 'utf8');
    const hashes = inlineScriptHashes(real);
    expect(hashes).toHaveLength(1); // yeni inline skript əlavə edilərsə bu test xəbərdarlıq edir (CSP hash-i avtomatik yenilənir, amma nəzərdən keçirilməlidir)
    expect(buildPageCsp(real)).toContain(hashes[0]);
    expect(real).not.toMatch(/<[a-z][^>]*\son(click|load|error)\s*=/i); // HTML atribut handler-i yoxdur (CSP onu bloklayardı)
  });
});
