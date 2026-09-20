// QA F8: zəif JWT_SECRET production-da serverin başlamasına icazə verməməlidir
const { evaluateJwtSecret, assertSecrets, generateSecret } = require('../src/config/secretsCheck');

const STRONG = generateSecret();

describe('evaluateJwtSecret', () => {
  it('güclü təsadüfi açar problemsizdir; generateSecret həmişə güclü açar verir', () => {
    expect(evaluateJwtSecret(STRONG)).toEqual([]);
    for (let i = 0; i < 20; i++) expect(evaluateJwtSecret(generateSecret())).toEqual([]);
  });

  it('boş, qısa, söz/ardıcıllıq ehtiva edən və təkrarlanan açarlar rədd edilir', () => {
    expect(evaluateJwtSecret('')).toEqual(['JWT_SECRET təyin edilməyib']);
    expect(evaluateJwtSecret('qisa')[0]).toMatch(/qısadır/);
    expect(evaluateJwtSecret('mening-gizli-secret-acarim-12345-uzun-olsun').join(' ')).toMatch(/secret.*12345|12345.*secret/);
    expect(evaluateJwtSecret('change-this-to-a-long-random-string-please').join(' ')).toMatch(/change-this/);
    expect(evaluateJwtSecret('a'.repeat(40)).join(' ')).toMatch(/təkrarlanan/);
    expect(evaluateJwtSecret('test-secret').length).toBeGreaterThan(0);
  });
});

describe('assertSecrets', () => {
  it('production + zəif açar → Error (server başlamır), mesajda yeni açar əmri var, sirrin özü yoxdur', () => {
    const weak = 'mening-gizli-secret-acarim-12345-uzun-olsun';
    let err;
    try {
      assertSecrets({ env: { NODE_ENV: 'production', JWT_SECRET: weak, PUBLIC_URL: 'https://x.az' } });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toMatch(/Server başlamır/);
    expect(err.message).toContain('randomBytes(48)');
    expect(err.message).not.toContain(weak);
  });

  it('production + güclü açar → keçir; PUBLIC_URL yoxdursa və test ödəniş provayderi varsa xəbərdarlıq qaytarır', () => {
    expect(assertSecrets({ env: { NODE_ENV: 'production', JWT_SECRET: STRONG, PUBLIC_URL: 'https://x.az' } })).toEqual([]);
    const warnings = assertSecrets({ env: { NODE_ENV: 'production', JWT_SECRET: STRONG, PAYMENT_PROVIDER: 'test' } });
    expect(warnings.join(' ')).toMatch(/PUBLIC_URL/);
    expect(warnings.join(' ')).toMatch(/PAYMENT_PROVIDER=test/);
  });

  it('inkişafda zəif açar yalnız xəbərdarlıqdır (server açılır)', () => {
    const warnings = assertSecrets({ env: { NODE_ENV: 'development', JWT_SECRET: 'test-secret' } });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/zəifdir/);
  });
});
