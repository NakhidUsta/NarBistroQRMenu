// QA D regresiyaları: şifrə siyasəti (tip + uzunluq), giriş limiti (IP+e-poçt / IP), sıfırlama məktubu limitində yarış
process.env.LOGIN_IP_LIMIT = '8'; // app.js yüklənməzdən əvvəl (limiter yüklənəndə oxunur)
process.env.LOGIN_LIMIT = '5';

const request = require('supertest');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/emailTokenRepository');
jest.mock('../src/repositories/adminSessionRepository');
jest.mock('../src/services/mailService');
jest.mock('../src/services/restaurantService', () => ({ getRestaurant: jest.fn().mockResolvedValue({ name: 'Test' }) }));
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('../src/sockets/emit', () => ({ disconnectAdmin: jest.fn(), disconnectSession: jest.fn(), getSocketStats: jest.fn() }));

const bcrypt = require('bcryptjs');
const adminUserRepository = require('../src/repositories/adminUserRepository');
const emailTokenRepository = require('../src/repositories/emailTokenRepository');
const mailService = require('../src/services/mailService');
const authService = require('../src/services/authService');
const accountEmailService = require('../src/services/accountEmailService');
const { assertPasswordAcceptable } = require('../src/utils/passwordPolicy');
const app = require('../src/app');

describe('şifrə siyasəti', () => {
  it('yalnız 8–128 simvollu MƏTN qəbul edilir (rəqəm/massiv/obyekt əvvəl bcrypt-də 500 verirdi)', () => {
    expect(() => assertPasswordAcceptable('12345678')).not.toThrow();
    expect(() => assertPasswordAcceptable('a'.repeat(128))).not.toThrow();
    for (const bad of [undefined, null, 12345678, ['abcdefgh'], { a: 'abcdefgh' }, 'short', 'a'.repeat(129), 'x'.repeat(90 * 1024)]) {
      expect(() => assertPasswordAcceptable(bad)).toThrow(expect.objectContaining({ status: 400 }));
    }
  });

  it('şifrə dəyişmə və e-poçtla sıfırlama eyni qaydanı tətbiq edir (token yandırılmadan əvvəl)', async () => {
    await expect(authService.changePassword(1, 'köhnə', 12345678)).rejects.toMatchObject({ status: 400 });
    await expect(authService.resetPasswordByEmail(1, ['abcdefgh'])).rejects.toMatchObject({ status: 400 });
    await expect(accountEmailService.resetPassword('tok', 'a'.repeat(200))).rejects.toMatchObject({ status: 400 });
    expect(emailTokenRepository.findByHash).not.toHaveBeenCalled(); // token axtarılmadı → yandırılmadı
  });
});

describe('e-poçt sahəsi yalnız mətn olmalıdır (massiv String()-lə ünvana çevrilirdi)', () => {
  it('changeEmail və staff yaratma massiv/rəqəm/uzun e-poçtu 400 ilə rədd edir; heç nə yazılmır', async () => {
    const staffService = require('../src/services/staffService');
    for (const bad of [['a@b.co'], 12345, { a: 'a@b.co' }, null, 'x'.repeat(200) + '@a.co']) {
      await expect(accountEmailService.changeEmail(1, 'Sifre123!', bad)).rejects.toMatchObject({ status: 400 });
      await expect(staffService.create({ email: bad, password: 'Sifre1234!', role: 'WAITER' })).rejects.toMatchObject({ status: 400 });
    }
    expect(adminUserRepository.updateEmail).not.toHaveBeenCalled();
    expect(adminUserRepository.create).not.toHaveBeenCalled();
  });
});

describe('giriş limiti', () => {
  const login = (email, ip) => request(app).post('/api/auth/login').set('X-Forwarded-For', ip || '').send({ email, password: 'yanlis-sifre' });

  it('bir e-poçt 5 uğursuz cəhddən sonra 429; eyni IP-dən BAŞQA e-poçt bloklanmır (paylaşılan Wi-Fi)', async () => {
    adminUserRepository.findByEmail.mockResolvedValue(null);
    for (let i = 0; i < 5; i++) expect((await login('a@x.az')).status).toBe(401);
    expect((await login('a@x.az')).status).toBe(429);
    expect((await login('b@x.az')).status).toBe(401); // IP-dən başqa hesab hələ işləyir
  });

  it('e-poçt böyük/kiçik hərflə dəyişdirilib limiti aşmaq olmur', async () => {
    adminUserRepository.findByEmail.mockResolvedValue(null);
    expect((await login('A@X.AZ')).status).toBe(429);
    expect((await login(' a@x.az ')).status).toBe(429);
  });

  it('e-poçtla şifrə sıfırlandıqdan sonra həmin IP+e-poçt sayğacı təmizlənir (yeni şifrə ilə 15 dəq gözləmək lazım deyil)', async () => {
    adminUserRepository.findByEmail.mockResolvedValue(null);
    expect((await login('a@x.az')).status).toBe(429); // hələ bloklu
    app.locals.resetLoginLimit({ ip: '::ffff:127.0.0.1' }, ' A@x.az ');
    expect((await login('a@x.az')).status).toBe(401); // blok götürüldü (indi yenidən sayır)
  });

  it('çoxlu hesabı yoxlayan hücum IP səviyyəsində dayanır (burada IP həddi 8)', async () => {
    adminUserRepository.findByEmail.mockResolvedValue(null);
    // yuxarıdakı testlərdə IP üzrə 7 uğursuz cəhd sayılıb (5×a + b + a; bloklanmış sorğular sayılmır); 1 dənə də həddi tamamlayır
    expect((await login('c@x.az')).status).toBe(401);
    expect((await login('d@x.az')).status).toBe(429);
  });
});

describe('sıfırlama məktubu limiti: paralel sorğu yarışı', () => {
  it('8 eyni anda gələn sorğu saatda ən çox 3 məktub yaradır', async () => {
    mailService.isConfigured.mockReturnValue(true);
    mailService.send.mockResolvedValue({});
    adminUserRepository.findByEmail.mockResolvedValue({ id: 7, email: 'staff@x.az' });
    let created = 0;
    emailTokenRepository.countRecent.mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5)); // DB gecikməsi: yarışı görünən edir
      return created;
    });
    emailTokenRepository.invalidateOpen.mockResolvedValue();
    emailTokenRepository.create.mockImplementation(async () => { created += 1; });
    await Promise.all(Array.from({ length: 8 }, () => accountEmailService.requestPasswordReset('staff@x.az')));
    await new Promise((r) => setTimeout(r, 300)); // arxa plan işləri
    expect(created).toBe(accountEmailService.MAX_TOKENS_PER_HOUR);
    expect(mailService.send).toHaveBeenCalledTimes(accountEmailService.MAX_TOKENS_PER_HOUR);
  });
});

void bcrypt;
