jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({}) }));
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/sockets/emit', () => ({ disconnectAdmin: jest.fn() }));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repo = require('../src/repositories/adminUserRepository');
const { disconnectAdmin } = require('../src/sockets/emit');
const authService = require('../src/services/authService');

const hash = bcrypt.hashSync('Correct123!', 4);
const admin = (over = {}) => ({
  id: 7, email: 'a@b.co', role: 'MANAGER', restaurant_id: 1, password_hash: hash,
  token_version: 2, failed_attempts: 0, locked_until: null, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  authService.invalidate(7);
});

describe('authService.login', () => {
  it('düzgün şifrə: token (tv daxil) qaytarır və uğursuz cəhdləri sıfırlayır', async () => {
    repo.findByEmail.mockResolvedValue(admin());
    const { token, admin: a } = await authService.login('a@b.co', 'Correct123!');
    expect(a).toEqual({ id: 7, email: 'a@b.co', role: 'MANAGER', restaurant_id: 1 });
    expect(jwt.verify(token, process.env.JWT_SECRET)).toMatchObject({ id: 7, tv: 2 });
    expect(repo.resetFailures).toHaveBeenCalledWith(7);
  });

  it('naməlum e-poçt: 401 və heç bir hesaba uğursuz cəhd yazılmır', async () => {
    repo.findByEmail.mockResolvedValue(null);
    await expect(authService.login('yox@b.co', 'x')).rejects.toMatchObject({ status: 401 });
    expect(repo.registerFailure).not.toHaveBeenCalled();
  });

  it('yanlış şifrə uğursuz cəhdi qeyd edir; limitə çatanda 429 (bloklanır)', async () => {
    repo.findByEmail.mockResolvedValue(admin());
    repo.registerFailure.mockResolvedValueOnce({ failed_attempts: 2 });
    await expect(authService.login('a@b.co', 'yanlis')).rejects.toMatchObject({ status: 401 });
    repo.registerFailure.mockResolvedValueOnce({ failed_attempts: 5 });
    await expect(authService.login('a@b.co', 'yanlis')).rejects.toMatchObject({ status: 429 });
    expect(repo.registerFailure).toHaveBeenCalledWith(7, 5, 15);
  });

  it('bloklanmış hesab düzgün şifrə ilə də girə bilmir', async () => {
    repo.findByEmail.mockResolvedValue(admin({ locked_until: new Date(Date.now() + 60_000) }));
    await expect(authService.login('a@b.co', 'Correct123!')).rejects.toMatchObject({ status: 429 });
    expect(repo.resetFailures).not.toHaveBeenCalled();
  });

  it('bloklama müddəti bitibsə giriş mümkündür', async () => {
    repo.findByEmail.mockResolvedValue(admin({ failed_attempts: 5, locked_until: new Date(Date.now() - 1000) }));
    await expect(authService.login('a@b.co', 'Correct123!')).resolves.toHaveProperty('token');
  });
});

describe('authService.authenticate', () => {
  const tokenFor = (tv) => jwt.sign({ id: 7, email: 'a@b.co', role: 'OWNER', tv }, process.env.JWT_SECRET);

  it('cari rolu DB-dən götürür (tokendəki rola etibar etmir)', async () => {
    repo.findAuthState.mockResolvedValue({ id: 7, email: 'a@b.co', role: 'WAITER', restaurant_id: 1, token_version: 2 });
    expect((await authService.authenticate(tokenFor(2))).role).toBe('WAITER');
  });

  it('token versiyası uyğun deyilsə 401', async () => {
    repo.findAuthState.mockResolvedValue({ id: 7, role: 'OWNER', token_version: 3 });
    await expect(authService.authenticate(tokenFor(2))).rejects.toMatchObject({ status: 401 });
  });

  it('silinmiş istifadəçi 401', async () => {
    repo.findAuthState.mockResolvedValue(null);
    await expect(authService.authenticate(tokenFor(2))).rejects.toMatchObject({ status: 401 });
  });

  it('imzası səhv və ya vaxtı bitmiş token 401', async () => {
    await expect(authService.authenticate('saxta')).rejects.toMatchObject({ status: 401 });
    const expired = jwt.sign({ id: 7, tv: 2 }, process.env.JWT_SECRET, { expiresIn: -10 });
    await expect(authService.authenticate(expired)).rejects.toMatchObject({ status: 401 });
  });

  it('nəticə qısa müddət keşlənir, revokeSessions keşi təmizləyir və socket-ləri bağlayır', async () => {
    repo.findAuthState.mockResolvedValue({ id: 7, email: 'a@b.co', role: 'OWNER', restaurant_id: 1, token_version: 2 });
    await authService.authenticate(tokenFor(2));
    await authService.authenticate(tokenFor(2));
    expect(repo.findAuthState).toHaveBeenCalledTimes(1);
    authService.revokeSessions(7);
    expect(disconnectAdmin).toHaveBeenCalledWith(7);
    await authService.authenticate(tokenFor(2));
    expect(repo.findAuthState).toHaveBeenCalledTimes(2);
  });
});

describe('authService.changePassword / logoutEverywhere', () => {
  beforeEach(() => {
    repo.findAuthState.mockResolvedValue({ id: 7, email: 'a@b.co', role: 'MANAGER', restaurant_id: 1, token_version: 2 });
    repo.findByEmail.mockResolvedValue(admin());
    repo.updatePassword.mockResolvedValue(3);
  });

  it('zəif və ya eyni yeni şifrə rədd edilir', async () => {
    await expect(authService.changePassword(7, 'Correct123!', '123')).rejects.toMatchObject({ status: 400 });
    await expect(authService.changePassword(7, 'Correct123!', 'Correct123!')).rejects.toMatchObject({ status: 400 });
  });

  it('cari şifrə yanlışdırsa dəyişmir', async () => {
    await expect(authService.changePassword(7, 'yanlis-sifre', 'NewPass1234')).rejects.toThrow(/Cari şifrə/);
    expect(repo.updatePassword).not.toHaveBeenCalled();
  });

  it('uğurlu dəyişiklik: yeni hash yazılır, yeni tv ilə token verilir, digər sessiyalar bağlanır', async () => {
    const { token } = await authService.changePassword(7, 'Correct123!', 'NewPass1234');
    const [, savedHash] = repo.updatePassword.mock.calls[0];
    expect(bcrypt.compareSync('NewPass1234', savedHash)).toBe(true);
    expect(jwt.verify(token, process.env.JWT_SECRET).tv).toBe(3);
    expect(disconnectAdmin).toHaveBeenCalledWith(7);
  });

  it('logoutEverywhere token versiyasını artırır və socket-ləri bağlayır', async () => {
    repo.bumpTokenVersion.mockResolvedValue(3);
    await authService.logoutEverywhere(7);
    expect(repo.bumpTokenVersion).toHaveBeenCalledWith(7);
    expect(disconnectAdmin).toHaveBeenCalledWith(7);
  });
});
