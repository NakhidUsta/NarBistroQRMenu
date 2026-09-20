jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({}) }));
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/adminSessionRepository');
jest.mock('../src/repositories/emailTokenRepository');
jest.mock('../src/services/mailService');
jest.mock('../src/services/restaurantService', () => ({ getRestaurant: jest.fn().mockResolvedValue({ name: 'Savora' }) }));
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn() }));
jest.mock('../src/sockets/emit', () => ({ disconnectAdmin: jest.fn(), disconnectSession: jest.fn() }));

const bcrypt = require('bcryptjs');
const users = require('../src/repositories/adminUserRepository');
const sessions = require('../src/repositories/adminSessionRepository');
const tokens = require('../src/repositories/emailTokenRepository');
const mail = require('../src/services/mailService');
const logger = require('../src/utils/logger');
const { disconnectAdmin } = require('../src/sockets/emit');
const service = require('../src/services/accountEmailService');
const authService = require('../src/services/authService');

const admin = { id: 7, email: 'owner@savora.az', role: 'OWNER' };
const future = (ms) => new Date(Date.now() + ms);
const flush = () => new Promise((r) => setImmediate(r)); // arxa plan işinin bitməsini gözləyir
const savedRaw = () => mail.send.mock.calls[0][0].text.match(/token=([^\s&]+)/)?.[1];

beforeEach(() => {
  jest.clearAllMocks();
  process.env.PUBLIC_URL = 'https://menu.savora.az/';
  mail.isConfigured.mockReturnValue(true);
  mail.send.mockResolvedValue({});
  users.findByEmail.mockResolvedValue(admin);
  users.findAuthState.mockResolvedValue({ ...admin, email_verified_at: null, token_version: 0 });
  users.setEmailVerified.mockResolvedValue();
  users.updatePassword.mockResolvedValue(1);
  tokens.countRecent.mockResolvedValue(0);
  tokens.invalidateOpen.mockResolvedValue();
  tokens.create.mockResolvedValue();
  tokens.markUsed.mockResolvedValue(true);
  sessions.revokeAllForUser.mockResolvedValue();
});
afterAll(() => delete process.env.PUBLIC_URL);

describe('şifrə sıfırlama tələbi', () => {
  it('mövcud hesab: token yaradılır (DB-də yalnız HASH, 30 dəq), köhnə açıq tokenlər ləğv edilir, məktub linklə göndərilir', async () => {
    await service.requestPasswordReset('owner@savora.az');
    await flush();
    expect(tokens.invalidateOpen).toHaveBeenCalledWith(7, 'reset');
    const saved = tokens.create.mock.calls[0][0];
    expect(saved).toMatchObject({ admin_user_id: 7, purpose: 'reset' });
    const ttl = new Date(saved.expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(29 * 60_000);
    expect(ttl).toBeLessThanOrEqual(30 * 60_000);

    const sent = mail.send.mock.calls[0][0];
    expect(sent).toMatchObject({ to: 'owner@savora.az', senderName: 'Savora' });
    const raw = savedRaw();
    expect(raw.length).toBeGreaterThanOrEqual(40);
    expect(saved.token_hash).toBe(service.hashToken(decodeURIComponent(raw)));
    expect(JSON.stringify(saved)).not.toContain(decodeURIComponent(raw)); // xam token saxlanılmır
    expect(sent.text).toContain('https://menu.savora.az/admin/reset-password?token=');
  });

  it('link PUBLIC_URL-dən qurulur (Host başlığından yox); o yoxdursa CLIENT_ORIGIN-dən', async () => {
    delete process.env.PUBLIC_URL;
    process.env.CLIENT_ORIGIN = 'http://localhost:5174';
    await service.requestPasswordReset('owner@savora.az');
    await flush();
    expect(mail.send.mock.calls[0][0].text).toContain('http://localhost:5174/admin/reset-password?token=');
  });

  it('naməlum e-poçt: heç token yaranmır, heç məktub getmir, amma xəta da yoxdur (hesab açıqlanmır)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(service.requestPasswordReset('yox@x.az')).resolves.toBeUndefined();
    await flush();
    expect(tokens.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('e-poçt xidməti qurulmayıbsa: sükutla keçir (cavab dəyişmir), xəbərdarlıq jurnala yazılır', async () => {
    mail.isConfigured.mockReturnValue(false);
    await expect(service.requestPasswordReset('owner@savora.az')).resolves.toBeUndefined();
    await flush();
    expect(users.findByEmail).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalled();
  });

  it('saatda 3-dən çox tələb: yeni token/məktub yoxdur (spam qoruması)', async () => {
    tokens.countRecent.mockResolvedValue(3);
    await service.requestPasswordReset('owner@savora.az');
    await flush();
    expect(tokens.create).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('məktub göndərilməsə də (Gmail xətası) istifadəçiyə xəta getmir, jurnala yazılır', async () => {
    mail.send.mockRejectedValue(new Error('smtp down'));
    await expect(service.requestPasswordReset('owner@savora.az')).resolves.toBeUndefined();
    await flush();
    expect(logger.error).toHaveBeenCalled();
  });
});

describe('şifrənin təyin edilməsi (link ilə)', () => {
  const row = (over = {}) => ({ id: 3, admin_user_id: 7, purpose: 'reset', expires_at: future(600_000), used_at: null, email: 'owner@savora.az', ...over });

  beforeEach(() => tokens.findByHash.mockResolvedValue(row()));

  it('uğurlu: token istifadə olunur, şifrə hash-lənir, BÜTÜN sessiyalar bağlanır, e-poçt təsdiqlənir', async () => {
    const user = await service.resetPassword('good-token', 'YeniSifre123');
    expect(tokens.findByHash).toHaveBeenCalledWith(service.hashToken('good-token'));
    expect(tokens.markUsed).toHaveBeenCalledWith(3);
    const [, savedHash] = users.updatePassword.mock.calls[0];
    expect(bcrypt.compareSync('YeniSifre123', savedHash)).toBe(true);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
    expect(disconnectAdmin).toHaveBeenCalledWith(7);
    expect(users.setEmailVerified).toHaveBeenCalledWith(7);
    expect(user).toEqual({ id: 7, email: 'owner@savora.az' });
  });

  it('zəif şifrə token istifadə olunmadan rədd edilir (istifadəçi düzəldib yenidən cəhd edə bilsin)', async () => {
    await expect(service.resetPassword('good-token', '123')).rejects.toMatchObject({ status: 400 });
    expect(tokens.markUsed).not.toHaveBeenCalled();
    expect(users.updatePassword).not.toHaveBeenCalled();
  });

  it.each([
    ['bilinməyən token', () => tokens.findByHash.mockResolvedValue(null)],
    ['istifadə olunmuş token', () => tokens.findByHash.mockResolvedValue(row({ used_at: new Date() }))],
    ['vaxtı bitmiş token', () => tokens.findByHash.mockResolvedValue(row({ expires_at: future(-1000) }))],
    ['başqa məqsədli (təsdiq) token', () => tokens.findByHash.mockResolvedValue(row({ purpose: 'verify' }))],
    ['paralel istifadə (yarışı itirən)', () => tokens.markUsed.mockResolvedValue(false)],
  ])('%s → 400 və şifrə dəyişmir', async (_, arrange) => {
    arrange();
    await expect(service.resetPassword('tok', 'YeniSifre123')).rejects.toMatchObject({ status: 400 });
    expect(users.updatePassword).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 123, 'x'.repeat(201)])('yararsız token dəyəri %p DB-yə çatmadan rədd edilir', async (bad) => {
    await expect(service.resetPassword(bad, 'YeniSifre123')).rejects.toMatchObject({ status: 400 });
    expect(tokens.findByHash).not.toHaveBeenCalled();
  });
});

describe('vaxt kanalı: cavab məktub göndərilməsini GÖZLƏMİR', () => {
  it('mövcud hesab üçün yavaş SMTP olsa da tələb dərhal qayıdır (hesab vaxt fərqi ilə aşkar edilə bilməz)', async () => {
    let releaseMail;
    mail.send.mockReturnValue(new Promise((r) => { releaseMail = r; }));
    const started = Date.now();
    await service.requestPasswordReset('owner@savora.az');
    expect(Date.now() - started).toBeLessThan(100);
    await flush();
    expect(mail.send).toHaveBeenCalledTimes(1); // iş arxa planda gedir
    releaseMail({});
  });
});

describe('e-poçt təsdiqi', () => {
  it('sendVerification: token (24 saat) yaradır və link göndərir', async () => {
    await service.sendVerification(7);
    expect(tokens.create).toHaveBeenCalledWith(expect.objectContaining({ purpose: 'verify' }));
    const ttl = new Date(tokens.create.mock.calls[0][0].expires_at).getTime() - Date.now();
    expect(ttl).toBeGreaterThan(23 * 3600_000);
    expect(mail.send.mock.calls[0][0].text).toContain('/admin/verify-email?token=');
  });

  it('artıq təsdiqlənibsə 409, xidmət yoxdursa 503, limit aşılıbsa 429', async () => {
    users.findAuthState.mockResolvedValue({ ...admin, email_verified_at: new Date() });
    await expect(service.sendVerification(7)).rejects.toMatchObject({ status: 409 });
    users.findAuthState.mockResolvedValue({ ...admin, email_verified_at: null });
    tokens.countRecent.mockResolvedValue(3);
    await expect(service.sendVerification(7)).rejects.toMatchObject({ status: 429 });
    mail.isConfigured.mockReturnValue(false);
    await expect(service.sendVerification(7)).rejects.toMatchObject({ status: 503 });
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('verifyEmail: tokeni istifadə edir və təsdiq işarəsi qoyur; reset tokeni ilə təsdiq olmur', async () => {
    tokens.findByHash.mockResolvedValue({ id: 4, admin_user_id: 7, purpose: 'verify', expires_at: future(1000), used_at: null, email: admin.email });
    await service.verifyEmail('tok');
    expect(users.setEmailVerified).toHaveBeenCalledWith(7);
    users.setEmailVerified.mockClear();
    tokens.findByHash.mockResolvedValue({ id: 5, admin_user_id: 7, purpose: 'reset', expires_at: future(1000), used_at: null, email: admin.email });
    await expect(service.verifyEmail('tok2')).rejects.toMatchObject({ status: 400 });
    expect(users.setEmailVerified).not.toHaveBeenCalled();
  });

  it('sendTestMail: sınaq məktubu yalnız öz ünvanına gedir', async () => {
    const result = await service.sendTestMail(7);
    expect(result).toEqual({ to: 'owner@savora.az' });
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'owner@savora.az' }));
  });

  it('sendTestMail SMTP xətasını olduğu kimi (dostcasına) yuxarı ötürür ki, OWNER səbəbi görsün', async () => {
    mail.send.mockRejectedValue(Object.assign(new Error('Tətbiq şifrəsi lazımdır'), { status: 502 }));
    await expect(service.sendTestMail(7)).rejects.toMatchObject({ status: 502 });
  });
});

describe('authService.resetPasswordByEmail', () => {
  it('yeni şifrə hash-lənir, token versiyası artır, sessiyalar bağlanır', async () => {
    await authService.resetPasswordByEmail(7, 'YeniSifre123');
    expect(bcrypt.compareSync('YeniSifre123', users.updatePassword.mock.calls[0][1])).toBe(true);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
  });

  it('8 simvoldan qısa şifrə 400', async () => {
    await expect(authService.resetPasswordByEmail(7, 'qisa')).rejects.toMatchObject({ status: 400 });
    expect(users.updatePassword).not.toHaveBeenCalled();
  });
});

describe('changeEmail (öz e-poçtunu dəyiş)', () => {
  const hash = bcrypt.hashSync('DogruSifre123', 4);
  beforeEach(() => {
    users.findByEmail.mockImplementation(async (email) => (email === 'owner@savora.az' ? { ...admin, password_hash: hash } : null));
    users.updateEmail.mockResolvedValue();
  });

  it('uğurlu: cari şifrə düzgündür → e-poçt dəyişir, köhnə reset/verify tokenləri ləğv edilir, yeni ünvana təsdiq məktubu gedir', async () => {
    users.findAuthState.mockResolvedValueOnce({ ...admin, email_verified_at: null, token_version: 0 }); // changeEmail
    users.findAuthState.mockResolvedValueOnce({ ...admin, email: 'yeni@gmail.com', email_verified_at: null, token_version: 0 }); // sendVerification (yenilənmiş)
    const out = await service.changeEmail(7, 'DogruSifre123', '  Yeni@Gmail.com ');
    expect(out).toMatchObject({ email: 'Yeni@Gmail.com', previous: 'owner@savora.az', verificationSent: true });
    expect(users.updateEmail).toHaveBeenCalledWith(7, 'Yeni@Gmail.com');
    expect(tokens.invalidateOpen).toHaveBeenCalledWith(7, 'reset');
    expect(tokens.invalidateOpen).toHaveBeenCalledWith(7, 'verify');
    expect(mail.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'yeni@gmail.com' }));
  });

  it('yanlış cari şifrə 400 — e-poçt dəyişmir, heç məktub getmir', async () => {
    await expect(service.changeEmail(7, 'yanlis', 'yeni@gmail.com')).rejects.toMatchObject({ status: 400 });
    expect(users.updateEmail).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('yanlış format 400; eyni ünvan 400; başqa hesabda olan ünvan 409', async () => {
    await expect(service.changeEmail(7, 'DogruSifre123', 'bu-email-deyil')).rejects.toMatchObject({ status: 400 });
    await expect(service.changeEmail(7, 'DogruSifre123', 'OWNER@savora.az')).rejects.toMatchObject({ status: 400 });
    users.findByEmail.mockImplementation(async (email) => (email === 'owner@savora.az' ? { ...admin, password_hash: hash } : { id: 99 }));
    await expect(service.changeEmail(7, 'DogruSifre123', 'baska@gmail.com')).rejects.toMatchObject({ status: 409 });
    expect(users.updateEmail).not.toHaveBeenCalled();
  });

  it('e-poçt xidməti qurulmayıbsa e-poçt yenə də dəyişir (verificationSent=false); məktub xətası dəyişikliyi pozmur', async () => {
    mail.isConfigured.mockReturnValue(false);
    expect(await service.changeEmail(7, 'DogruSifre123', 'yeni@gmail.com')).toMatchObject({ verificationSent: false });
    expect(users.updateEmail).toHaveBeenCalledTimes(1);

    mail.isConfigured.mockReturnValue(true);
    mail.send.mockRejectedValue(new Error('smtp down'));
    expect(await service.changeEmail(7, 'DogruSifre123', 'yeni2@gmail.com')).toMatchObject({ verificationSent: false });
    expect(users.updateEmail).toHaveBeenCalledTimes(2);
  });
});
