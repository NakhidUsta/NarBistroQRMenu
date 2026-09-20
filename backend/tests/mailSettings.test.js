const request = require('supertest');
const { cookieFor } = require('./helpers');

jest.mock('../src/config/db', () => {
  const sql = jest.requireActual('mssql');
  const { fakePool } = require('./helpers');
  return { sql, poolPromise: Promise.resolve(fakePool) };
});
jest.mock('../src/repositories/adminUserRepository', () => {
  const { authStateFor } = require('./helpers');
  return { findAuthState: jest.fn(async (id) => authStateFor(id)) };
});
jest.mock('../src/services/auditService', () => ({ list: jest.fn().mockResolvedValue([]), log: jest.fn() }));
jest.mock('../src/repositories/mailSettingsRepository');
jest.mock('../src/services/restaurantService', () => ({ getRestaurant: jest.fn().mockResolvedValue({ name: 'Nar Bistro' }) }));
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));
jest.mock('nodemailer');

const nodemailer = require('nodemailer');
const mailSettingsRepository = require('../src/repositories/mailSettingsRepository');
const auditService = require('../src/services/auditService');
const mailService = require('../src/services/mailService');
const mailSettingsService = require('../src/services/mailSettingsService');
const { encrypt, decrypt } = require('../src/utils/secretBox');
const app = require('../src/app');

let transport;
const PASS = 'abcdefghijklmnop';

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
  delete process.env.MAIL_DRIVER;
  mailService.setStoredConfig(null);
  transport = { verify: jest.fn().mockResolvedValue(true), sendMail: jest.fn().mockResolvedValue({ messageId: 'm1' }), close: jest.fn() };
  nodemailer.createTransport.mockReturnValue(transport);
  mailSettingsRepository.get.mockResolvedValue(null);
  mailSettingsRepository.save.mockResolvedValue();
  mailSettingsRepository.remove.mockResolvedValue();
});

describe('secretBox (şifrələmə)', () => {
  it('şifrələyib açır; açıq mətn nəticədə yoxdur; hər dəfə fərqli (təsadüfi IV)', () => {
    const a = encrypt(PASS);
    const b = encrypt(PASS);
    expect(a).not.toContain(PASS);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(PASS);
  });

  it('dəyişdirilmiş məlumat və ya başqa JWT_SECRET ilə açılmır', () => {
    const enc = encrypt(PASS);
    const parts = enc.split(':');
    parts[3] = parts[3].replace(/.$/, (c) => (c === '0' ? '1' : '0'));
    expect(() => decrypt(parts.join(':'))).toThrow();
    const old = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'basqa-sirr';
    expect(() => decrypt(enc)).toThrow();
    process.env.JWT_SECRET = old;
    expect(() => decrypt('zibil')).toThrow();
  });
});

describe('mailService: giriş mənbəyi', () => {
  it('panel girişi .env-dən üstündür; heç biri yoxdursa qurulmayıb', () => {
    expect(mailService.isConfigured()).toBe(false);
    expect(mailService.configSource()).toBeNull();
    process.env.SMTP_USER = 'env@gmail.com';
    process.env.SMTP_PASS = 'envpassword12345';
    expect(mailService.configSource()).toBe('env');
    mailService.setStoredConfig({ user: 'panel@gmail.com', pass: PASS });
    expect(mailService.configSource()).toBe('panel');
    expect(mailService.isConfigured()).toBe(true);
  });

  it('məktub panel girişi ilə göndərilir (from = panel Gmail ünvanı)', async () => {
    mailService.setStoredConfig({ user: 'panel@gmail.com', pass: 'abcd efgh ijkl mnop' });
    await mailService.send({ to: 'x@y.az', subject: 's', text: 't', senderName: 'Nar Bistro' });
    const auth = nodemailer.createTransport.mock.calls.at(-1)[0].auth;
    expect(auth).toEqual({ user: 'panel@gmail.com', pass: 'abcdefghijklmnop' }); // boşluqlar silinir
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Nar Bistro" <panel@gmail.com>', to: 'x@y.az' }));
  });

  it('verifyCredentials: Gmail rədd edərsə dostcasına 502 (App Password izahı), uğurdadırsa keçir', async () => {
    await expect(mailService.verifyCredentials({ user: 'a@gmail.com', pass: PASS })).resolves.toBeUndefined();
    expect(transport.close).toHaveBeenCalled();
    transport.verify.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 }));
    await expect(mailService.verifyCredentials({ user: 'a@gmail.com', pass: 'yanlis-sifre-123' })).rejects.toMatchObject({ status: 502, message: expect.stringContaining('Tətbiq şifrəsi') });
  });
});

describe('mailSettingsService', () => {
  it('yanlış Gmail ünvanı və ya boş/qısa şifrə 400 — Gmail-ə heç müraciət olmur', async () => {
    await expect(mailSettingsService.save({ smtp_user: 'gmail-deyil', smtp_pass: PASS }, 1)).rejects.toMatchObject({ status: 400 });
    await expect(mailSettingsService.save({ smtp_user: 'a@gmail.com', smtp_pass: '' }, 1)).rejects.toMatchObject({ status: 400 });
    await expect(mailSettingsService.save({ smtp_user: 'a@gmail.com', smtp_pass: 'qisa' }, 1)).rejects.toMatchObject({ status: 400 });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(mailSettingsRepository.save).not.toHaveBeenCalled();
  });

  it('Gmail girişi uğursuzdursa NƏ SAXLANILIR, NƏ də işə düşür', async () => {
    transport.verify.mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH', responseCode: 535 }));
    await expect(mailSettingsService.save({ smtp_user: 'a@gmail.com', smtp_pass: PASS }, 1)).rejects.toMatchObject({ status: 502 });
    expect(mailSettingsRepository.save).not.toHaveBeenCalled();
    expect(mailService.isConfigured()).toBe(false);
  });

  it('uğurlu: şifrə ŞİFRƏLƏNMİŞ saxlanılır (açıq mətn yox), dərhal işə düşür, cavabda şifrə yoxdur', async () => {
    mailSettingsRepository.get.mockResolvedValue({ smtp_user: 'a@gmail.com', updated_at: new Date() });
    const status = await mailSettingsService.save({ smtp_user: ' A@gmail.com ', smtp_pass: 'abcd efgh ijkl mnop' }, 1);
    const saved = mailSettingsRepository.save.mock.calls[0][0];
    expect(saved.smtp_user).toBe('A@gmail.com');
    expect(saved.smtp_pass_enc).not.toContain(PASS);
    expect(decrypt(saved.smtp_pass_enc)).toBe(PASS);
    expect(saved.updated_by).toBe(1);
    expect(mailService.configSource()).toBe('panel');
    expect(status).toMatchObject({ configured: true, source: 'panel', smtp_user: 'a@gmail.com' });
    expect(JSON.stringify(status)).not.toContain(PASS);
  });

  it('load(): bazadakı şifrəli giriş açılıb işə salınır; açılmırsa (başqa JWT_SECRET) .env-ə qayıdılır', async () => {
    mailSettingsRepository.get.mockResolvedValue({ smtp_user: 'saved@gmail.com', smtp_pass_enc: encrypt(PASS) });
    await mailSettingsService.load();
    expect(mailService.configSource()).toBe('panel');
    mailSettingsRepository.get.mockResolvedValue({ smtp_user: 'saved@gmail.com', smtp_pass_enc: 'v1:00:00:00' });
    await mailSettingsService.load();
    expect(mailService.configSource()).toBeNull();
  });

  it('remove(): giriş silinir və xidmət söndürülür; sendTest sınaq məktubunu qoşulan Gmail ünvanına göndərir', async () => {
    mailService.setStoredConfig({ user: 'panel@gmail.com', pass: PASS });
    mailSettingsRepository.get.mockResolvedValue({ smtp_user: 'panel@gmail.com' });
    expect(await mailSettingsService.sendTest()).toEqual({ to: 'panel@gmail.com' });
    expect(transport.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: 'panel@gmail.com' }));
    await mailSettingsService.remove();
    expect(mailSettingsRepository.remove).toHaveBeenCalled();
    expect(mailService.isConfigured()).toBe(false);
    await expect(mailSettingsService.sendTest()).rejects.toMatchObject({ status: 503 });
  });
});

describe('HTTP: /api/mail-settings', () => {
  const put = (role, body) => request(app).put('/api/mail-settings').set('Cookie', cookieFor(role)).send(body);

  it('yalnız OWNER: menecer/ofisiant/mətbəx 403, girişsiz 401', async () => {
    expect((await request(app).get('/api/mail-settings')).status).toBe(401);
    for (const role of ['MANAGER', 'WAITER', 'KITCHEN']) {
      expect((await request(app).get('/api/mail-settings').set('Cookie', cookieFor(role))).status).toBe(403);
      expect((await put(role, { smtp_user: 'a@gmail.com', smtp_pass: PASS })).status).toBe(403);
    }
    expect(mailSettingsRepository.save).not.toHaveBeenCalled();
  });

  it('OWNER saxlayır → "Şifrəni unutdunuz" dərhal aktiv olur; GET/PUT cavabında şifrə HEÇ VAXT yoxdur; audit logda şifrə yoxdur', async () => {
    expect((await request(app).get('/api/auth/config')).body.password_reset).toBe(false);
    const res = await put('OWNER', { smtp_user: 'owner@gmail.com', smtp_pass: PASS });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('Gmail qoşuldu');
    expect(JSON.stringify(res.body)).not.toContain(PASS);
    expect((await request(app).get('/api/auth/config')).body.password_reset).toBe(true);

    mailSettingsRepository.get.mockResolvedValue({ smtp_user: 'owner@gmail.com', updated_at: new Date() });
    const status = await request(app).get('/api/mail-settings').set('Cookie', cookieFor('OWNER'));
    expect(status.body).toMatchObject({ configured: true, source: 'panel', smtp_user: 'owner@gmail.com' });
    expect(JSON.stringify(status.body)).not.toMatch(/pass|enc/i);
    expect(JSON.stringify(auditService.log.mock.calls.map((c) => c.slice(1)))).not.toContain(PASS); // ilk arqument req-dir (dairəvi struktur)
  });

  it('yanlış App Password: 502 və heç nə saxlanmır; sınaq və silmə işləyir', async () => {
    transport.verify.mockRejectedValue(Object.assign(new Error('bad'), { code: 'EAUTH', responseCode: 535 }));
    const bad = await put('OWNER', { smtp_user: 'owner@gmail.com', smtp_pass: 'yanlis-sifre-123' });
    expect(bad.status).toBe(502);
    expect(mailSettingsRepository.save).not.toHaveBeenCalled();

    transport.verify.mockResolvedValue(true);
    await put('OWNER', { smtp_user: 'owner@gmail.com', smtp_pass: PASS });
    mailSettingsRepository.get.mockResolvedValue({ smtp_user: 'owner@gmail.com' });
    const test = await request(app).post('/api/mail-settings/test').set('Cookie', cookieFor('OWNER'));
    expect(test.status).toBe(200);
    expect(test.body.message).toContain('owner@gmail.com');
    const del = await request(app).delete('/api/mail-settings').set('Cookie', cookieFor('OWNER'));
    expect(del.status).toBe(200);
    expect(del.body.configured).toBe(false);
  });
});
