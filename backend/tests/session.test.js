const jwt = require('jsonwebtoken');

jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({}) }));
jest.mock('../src/repositories/adminUserRepository');
jest.mock('../src/repositories/adminSessionRepository');
jest.mock('../src/sockets/emit', () => ({ disconnectAdmin: jest.fn(), disconnectSession: jest.fn() }));

const repo = require('../src/repositories/adminUserRepository');
const sessions = require('../src/repositories/adminSessionRepository');
const { disconnectAdmin, disconnectSession } = require('../src/sockets/emit');
const authService = require('../src/services/authService');
const bcrypt = require('bcryptjs');

const hash = bcrypt.hashSync('Correct123!', 4);
const admin = (over = {}) => ({
  id: 7, email: 'a@b.co', role: 'MANAGER', restaurant_id: 1, password_hash: hash,
  token_version: 2, failed_attempts: 0, locked_until: null, ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  authService.invalidate(7);
  authService.revokeSessions(7);
  disconnectAdmin.mockClear();
  sessions.createSession.mockResolvedValue({ id: 11, expires_at: new Date(Date.now() + 7 * 24 * 3600 * 1000) });
  sessions.insertToken.mockResolvedValue();
  sessions.purgeOld.mockResolvedValue();
  sessions.revokeAllForUser.mockResolvedValue();
  sessions.revokeSession.mockResolvedValue(true);
  sessions.touchSession.mockResolvedValue();
});

describe('login: access token ömrü və refresh token yaradılması', () => {
  it('access token qısa ömürlüdür (defolt 15 dəq), refresh token təsadüfi və yalnız HASH kimi saxlanılır', async () => {
    repo.findByEmail.mockResolvedValue(admin());
    const { token, refreshToken } = await authService.login('a@b.co', 'Correct123!', { ip: '1.2.3.4', userAgent: 'Chrome/1' });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
    expect(refreshToken.length).toBeGreaterThanOrEqual(60);
    const saved = sessions.insertToken.mock.calls[0][0];
    expect(saved.token_hash).toBe(authService.hashToken(refreshToken));
    expect(JSON.stringify(saved)).not.toContain(refreshToken);
    expect(sessions.createSession).toHaveBeenCalledWith(expect.objectContaining({ admin_user_id: 7, ip: '1.2.3.4', user_agent: 'Chrome/1' }));
  });

  it('refresh token-in vaxtı sessiyanın mütləq ömründən uzun ola bilməz', async () => {
    sessions.createSession.mockResolvedValue({ id: 11, expires_at: new Date(Date.now() + 60_000) });
    repo.findByEmail.mockResolvedValue(admin());
    await authService.login('a@b.co', 'Correct123!');
    expect(new Date(sessions.insertToken.mock.calls[0][0].expires_at).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
  });
});

describe('authService.refresh (rotasiya)', () => {
  const RAW = 'raw-refresh-token-value';
  const future = (ms = 3600_000) => new Date(Date.now() + ms);
  const row = (over = {}) => ({
    id: 5, session_id: 11, admin_user_id: 7, expires_at: future(), used_at: null,
    session_expires_at: future(86400_000), session_revoked_at: null, ...over,
  });

  beforeEach(() => {
    sessions.findTokenByHash.mockResolvedValue(row());
    sessions.markTokenUsed.mockResolvedValue(true);
    repo.findAuthState.mockResolvedValue({ id: 7, email: 'a@b.co', role: 'OWNER', restaurant_id: 1, token_version: 2 });
  });

  it('düzgün token: köhnə istifadə olunur, YENİ refresh token və yeni access token verilir (cari rolla)', async () => {
    const result = await authService.refresh(RAW, { ip: '9.9.9.9', userAgent: 'UA' });
    expect(sessions.findTokenByHash).toHaveBeenCalledWith(authService.hashToken(RAW));
    expect(sessions.markTokenUsed).toHaveBeenCalledWith(5);
    expect(result.refreshToken).not.toBe(RAW);
    expect(sessions.insertToken).toHaveBeenCalledWith(expect.objectContaining({ session_id: 11, token_hash: authService.hashToken(result.refreshToken) }));
    expect(jwt.verify(result.token, process.env.JWT_SECRET)).toMatchObject({ id: 7, role: 'OWNER', sid: 11, tv: 2 });
    expect(sessions.touchSession).toHaveBeenCalledWith(11, { user_agent: 'UA', ip: '9.9.9.9' });
  });

  it.each([
    ['token yoxdur', undefined],
    ['token bilinmir', RAW],
  ])('%s → 401', async (_, raw) => {
    sessions.findTokenByHash.mockResolvedValue(null);
    await expect(authService.refresh(raw)).rejects.toMatchObject({ status: 401 });
    expect(sessions.markTokenUsed).not.toHaveBeenCalled();
  });

  it('bağlanmış sessiya, vaxtı bitmiş token və mütləq ömrü bitmiş sessiya 401', async () => {
    sessions.findTokenByHash.mockResolvedValue(row({ session_revoked_at: new Date() }));
    await expect(authService.refresh(RAW)).rejects.toMatchObject({ status: 401 });
    sessions.findTokenByHash.mockResolvedValue(row({ expires_at: future(-1000) }));
    await expect(authService.refresh(RAW)).rejects.toMatchObject({ status: 401 });
    sessions.findTokenByHash.mockResolvedValue(row({ session_expires_at: future(-1000) }));
    await expect(authService.refresh(RAW)).rejects.toMatchObject({ status: 401 });
    expect(sessions.insertToken).not.toHaveBeenCalled();
  });

  it('OĞURLUQ ƏLAMƏTİ: artıq rotasiya olunmuş token pəncərədən sonra təkrar təqdim edilsə bütün sessiya bağlanır', async () => {
    sessions.findTokenByHash.mockResolvedValue(row({ used_at: new Date(Date.now() - 60_000) }));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(authService.refresh(RAW)).rejects.toMatchObject({ status: 401 });
    warn.mockRestore();
    expect(sessions.revokeSession).toHaveBeenCalledWith(11);
    expect(disconnectSession).toHaveBeenCalledWith(11);
    expect(sessions.insertToken).not.toHaveBeenCalled();
  });

  it('paralel tab: token 10 saniyə pəncərəsində təkrar istifadə olunubsa sessiya bağlanmır, yeni token verilir', async () => {
    sessions.findTokenByHash.mockResolvedValue(row({ used_at: new Date(Date.now() - 2000) }));
    const result = await authService.refresh(RAW);
    expect(result.refreshToken).toBeTruthy();
    expect(sessions.revokeSession).not.toHaveBeenCalled();
    expect(sessions.markTokenUsed).not.toHaveBeenCalled();
  });

  it('iki sorğu eyni anda gəlib markTokenUsed yarışını itirsə də sessiya bağlanmır', async () => {
    sessions.markTokenUsed.mockResolvedValue(false);
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    await expect(authService.refresh(RAW)).resolves.toHaveProperty('token');
    warn.mockRestore();
    expect(sessions.revokeSession).not.toHaveBeenCalled();
  });

  it('istifadəçi silinibsə 401', async () => {
    repo.findAuthState.mockResolvedValue(null);
    await expect(authService.refresh(RAW)).rejects.toMatchObject({ status: 401 });
  });
});

describe('sessiya idarəsi: access token yoxlaması, çıxış, cihaz siyahısı', () => {
  const tokenWithSid = (sid) => jwt.sign({ id: 7, email: 'a@b.co', role: 'OWNER', tv: 2, sid }, process.env.JWT_SECRET);
  const future = new Date(Date.now() + 3600_000);

  beforeEach(() => {
    repo.findAuthState.mockResolvedValue({ id: 7, email: 'a@b.co', role: 'OWNER', restaurant_id: 1, token_version: 2 });
  });

  it('ləğv edilmiş sessiyanın access token-i (imza etibarlı olsa da) dərhal 401 verir', async () => {
    sessions.findSession.mockResolvedValue({ id: 21, admin_user_id: 7, expires_at: future, revoked_at: new Date() });
    await expect(authService.authenticate(tokenWithSid(21))).rejects.toMatchObject({ status: 401 });
  });

  it('aktiv sessiya keçir və sid qaytarılır; sid-siz köhnə token də keçir', async () => {
    sessions.findSession.mockResolvedValue({ id: 22, admin_user_id: 7, expires_at: future, revoked_at: null });
    expect(await authService.authenticate(tokenWithSid(22))).toMatchObject({ id: 7, sid: 22 });
    authService.invalidate(7);
    expect(await authService.authenticate(jwt.sign({ id: 7, tv: 2 }, process.env.JWT_SECRET))).toMatchObject({ id: 7, sid: undefined });
  });

  it('mütləq ömrü bitmiş sessiya 401', async () => {
    sessions.findSession.mockResolvedValue({ id: 23, admin_user_id: 7, expires_at: new Date(Date.now() - 1000), revoked_at: null });
    await expect(authService.authenticate(tokenWithSid(23))).rejects.toMatchObject({ status: 401 });
  });

  it('logout: yalnız cari sessiyanı bağlayır və o cihazın socket-lərini kəsir; digər cihazlara toxunmur', async () => {
    sessions.findTokenByHash.mockResolvedValue({ session_id: 31 });
    await authService.logout({ refreshToken: 'x' });
    expect(sessions.revokeSession).toHaveBeenCalledWith(31);
    expect(disconnectSession).toHaveBeenCalledWith(31);
    expect(disconnectAdmin).not.toHaveBeenCalled();
    expect(sessions.revokeAllForUser).not.toHaveBeenCalled();
  });

  it('logout token olmadan səssizcə keçir', async () => {
    await expect(authService.logout({})).resolves.toBeUndefined();
    expect(sessions.revokeSession).not.toHaveBeenCalled();
  });

  it('logoutEverywhere bütün sessiyaları bağlayır', async () => {
    repo.bumpTokenVersion.mockResolvedValue(3);
    await authService.logoutEverywhere(7);
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
  });

  it('şifrə dəyişəndə bütün köhnə sessiyalar bağlanır, cari cihaz yeni sessiya alır', async () => {
    repo.findByEmail.mockResolvedValue(admin());
    repo.updatePassword.mockResolvedValue(3);
    const result = await authService.changePassword(7, 'Correct123!', 'NewPass1234');
    expect(sessions.revokeAllForUser).toHaveBeenCalledWith(7);
    expect(sessions.createSession).toHaveBeenCalled();
    expect(result.refreshToken).toBeTruthy();
  });

  it('cihaz siyahısı cari sessiyanı işarələyir; başqasının sessiyasını bağlamaq olmur (404)', async () => {
    sessions.listActive.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    expect(await authService.listSessions(7, 2)).toEqual([{ id: 1, current: false }, { id: 2, current: true }]);
    sessions.findSession.mockResolvedValue({ id: 9, admin_user_id: 8 });
    await expect(authService.revokeSession(7, 9)).rejects.toMatchObject({ status: 404 });
    expect(sessions.revokeSession).not.toHaveBeenCalled();
    sessions.findSession.mockResolvedValue({ id: 10, admin_user_id: 7 });
    await authService.revokeSession(7, 10);
    expect(sessions.revokeSession).toHaveBeenCalledWith(10);
    expect(disconnectSession).toHaveBeenCalledWith(10);
  });
});
