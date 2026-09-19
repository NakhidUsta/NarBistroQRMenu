jest.mock('nodemailer', () => {
  const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
  return { createTransport: jest.fn(() => ({ sendMail })), __sendMail: sendMail };
});
jest.mock('../src/utils/logger', () => ({ error: jest.fn(), warn: jest.fn() }));

const nodemailer = require('nodemailer');
const mailService = require('../src/services/mailService');
const templates = require('../src/services/mailTemplates');

const sendMail = nodemailer.__sendMail;
const base = { to: 'ali@example.az', subject: 'Salam', text: 'mətn', html: '<p>mətn</p>', senderName: 'Savora' };

beforeEach(() => {
  jest.clearAllMocks();
  mailService.resetTransport();
  for (const k of ['SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'MAIL_FROM', 'MAIL_DRIVER']) delete process.env[k];
});

describe('mailService konfiqurasiyası', () => {
  it('SMTP_USER/SMTP_PASS yoxdursa xidmət söndürülüb: isConfigured=false, send 503 atır, heç nə göndərilmir', async () => {
    expect(mailService.isConfigured()).toBe(false);
    await expect(mailService.send(base)).rejects.toMatchObject({ status: 503 });
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
  });

  it('yalnız biri təyin olunubsa (məs. şifrəsiz) qurulmamış sayılır', () => {
    process.env.SMTP_USER = 'r@gmail.com';
    expect(mailService.isConfigured()).toBe(false);
  });

  it('Gmail defoltları: smtp.gmail.com:465 (birbaşa TLS), Tətbiq şifrəsindən boşluqlar silinir, göndərən = Gmail ünvanı', async () => {
    process.env.SMTP_USER = 'restoran@gmail.com';
    process.env.SMTP_PASS = 'abcd efgh ijkl mnop';
    expect(mailService.isConfigured()).toBe(true);
    await mailService.send(base);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'restoran@gmail.com', pass: 'abcdefghijklmnop' },
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: '"Savora" <restoran@gmail.com>', to: 'ali@example.az', subject: 'Salam' }));
  });

  it('587 portu STARTTLS (secure=false) işlədir; MAIL_FROM göndərən ünvanı əvəz edir', async () => {
    process.env.SMTP_USER = 'r@gmail.com';
    process.env.SMTP_PASS = 'pass';
    process.env.SMTP_PORT = '587';
    process.env.MAIL_FROM = 'Savora Menyu <no-reply@savora.az>';
    await mailService.send(base);
    expect(nodemailer.createTransport).toHaveBeenCalledWith(expect.objectContaining({ port: 587, secure: false }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ from: 'Savora Menyu <no-reply@savora.az>' }));
  });

  it('göndərən adında dırnaq/sətir sonu (header injection) təmizlənir', async () => {
    process.env.SMTP_USER = 'r@gmail.com';
    process.env.SMTP_PASS = 'pass';
    await mailService.send({ ...base, senderName: 'Bad"\r\nBcc: evil@x.az' });
    const from = sendMail.mock.calls[0][0].from;
    expect(from).not.toMatch(/[\r\n]/);
    expect(from.startsWith('"Bad')).toBe(true);
  });

  it('transport eyni ayarlarla təkrar istifadə olunur (hər məktub üçün yeni bağlantı yox)', async () => {
    process.env.SMTP_USER = 'r@gmail.com';
    process.env.SMTP_PASS = 'pass';
    await mailService.send(base);
    await mailService.send(base);
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
  });
});

describe('mailService xəta xəritələnməsi (texniki detal istifadəçiyə sızmır)', () => {
  beforeEach(() => {
    process.env.SMTP_USER = 'r@gmail.com';
    process.env.SMTP_PASS = 'pass';
  });

  it('EAUTH / 535 → Tətbiq şifrəsi (App Password) izahı', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('Invalid login: 535-5.7.8 Username and Password not accepted'), { code: 'EAUTH', responseCode: 535 }));
    const err = await mailService.send(base).catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toContain('Tətbiq şifrəsi');
    expect(err.message).not.toContain('535-5.7.8');
  });

  it('şəbəkə xətası → qoşulma izahı', async () => {
    sendMail.mockRejectedValueOnce(Object.assign(new Error('connect ETIMEDOUT 1.2.3.4:465'), { code: 'ETIMEDOUT' }));
    const err = await mailService.send(base).catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toContain('SMTP serverinə qoşulmaq');
    expect(err.message).not.toContain('1.2.3.4');
  });

  it('naməlum xəta → ümumi mesaj', async () => {
    sendMail.mockRejectedValueOnce(new Error('daxili sirr'));
    const err = await mailService.send(base).catch((e) => e);
    expect(err).toMatchObject({ status: 502, message: 'E-poçt göndərilə bilmədi' });
  });
});

describe('MAIL_DRIVER=console (yalnız dev)', () => {
  it('nodemailer-ə toxunmur, məktubu konsola yazır', async () => {
    process.env.MAIL_DRIVER = 'console';
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(mailService.isConfigured()).toBe(true);
    await mailService.send(base);
    expect(nodemailer.createTransport).not.toHaveBeenCalled();
    expect(log.mock.calls.join(' ')).toContain('ali@example.az');
    log.mockRestore();
  });
});

describe('mailTemplates', () => {
  it('şifrə sıfırlama: link, müddət və "siz göndərməmisinizsə" xəbərdarlığı var; HTML-də dəyişənlər escape olunur', () => {
    const t = templates.passwordReset({ link: 'https://menu.az/admin/reset-password?token=a&b="x"', restaurant: 'Sav<b>ora</b>', minutes: 30 });
    expect(t.subject).toContain('şifrənin sıfırlanması');
    expect(t.text).toContain('https://menu.az/admin/reset-password?token=a&b="x"');
    expect(t.text).toContain('30 dəqiqə');
    expect(t.text).toContain('nəzərə almayın');
    expect(t.html).not.toContain('<b>ora</b>');
    expect(t.html).toContain('Sav&lt;b&gt;ora&lt;/b&gt;');
    expect(t.html).not.toContain('token=a&b="x"'); // xam dırnaq atributu qıra bilməz
    expect(t.html).toContain('token=a&amp;b=&quot;x&quot;');
  });

  it('təsdiq və sınaq şablonları mövzu/mətn qaytarır', () => {
    expect(templates.emailVerification({ link: 'https://x/y', restaurant: 'R', hours: 24 }).text).toContain('24 saat');
    expect(templates.testMail({ restaurant: 'R' }).subject).toContain('sınaq');
  });
});
