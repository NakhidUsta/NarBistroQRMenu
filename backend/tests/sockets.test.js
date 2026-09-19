// Real Socket.io serveri + real klientlər (yalnız DB/servis asılılıqları saxtadır)
process.env.SOCKET_ACK_TIMEOUT_MS = '250';

const http = require('http');
const { io: connect } = require('socket.io-client');

jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({}) }));
jest.mock('../src/services/authService', () => ({
  authenticate: jest.fn(async (token) => {
    if (token !== 'good') throw new Error('bad');
    return { id: 1, email: 'o@x.az', role: 'OWNER' };
  }),
}));
jest.mock('../src/services/orderService', () => ({ hasAccess: jest.fn() }));

const orderService = require('../src/services/orderService');
const { initSockets, SOCKET_OPTIONS } = require('../src/sockets');
const emit = require('../src/sockets/emit');

let server;
let url;
let ioServer;
const clients = [];

const opts = (extra = {}) => ({ transports: ['websocket'], reconnectionDelay: 30, reconnectionDelayMax: 60, ...extra });
const newClient = (path = '', extra = {}) => {
  const c = connect(`${url}${path}`, opts(extra));
  clients.push(c);
  return c;
};
const connected = (c) => new Promise((resolve, reject) => { c.once('connect', () => resolve(c)); c.once('connect_error', reject); });
const once = (c, event) => new Promise((resolve) => c.once(event, resolve));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const emitAck = (c, event, payload) => new Promise((resolve) => c.emit(event, payload, resolve));

beforeAll(async () => {
  server = http.createServer();
  ioServer = initSockets(server);
  await new Promise((r) => server.listen(0, r));
  url = `http://localhost:${server.address().port}`;
});
afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  jest.clearAllMocks();
  await sleep(80); // server tərəfində bağlanan socket-lərin otaqlardan çıxması
});
afterAll(async () => {
  await ioServer.close();
});

describe('konfiqurasiya', () => {
  it('heartbeat və qısa kəsilmə bərpası aktivdir; bərpa zamanı auth orta qatı da işləyir', () => {
    expect(SOCKET_OPTIONS.pingInterval).toBe(25000);
    expect(SOCKET_OPTIONS.pingTimeout).toBe(20000);
    expect(SOCKET_OPTIONS.connectionStateRecovery).toMatchObject({ maxDisconnectionDuration: 120000, skipMiddlewares: false });
  });
});

describe('join-order (sifariş otağı)', () => {
  it('yanlış format və yanlış token rədd edilir, düzgün token qəbul edilir (ack ilə)', async () => {
    const c = await connected(newClient());
    expect(await emitAck(c, 'join-order', 5)).toEqual({ ok: false, error: 'invalid' }); // token yoxdur
    expect(await emitAck(c, 'join-order', { id: 'x', token: 't' })).toEqual({ ok: false, error: 'invalid' });
    orderService.hasAccess.mockResolvedValueOnce(false);
    expect(await emitAck(c, 'join-order', { id: 5, token: 'wrong' })).toEqual({ ok: false, error: 'forbidden' });
    orderService.hasAccess.mockResolvedValueOnce(true);
    expect(await emitAck(c, 'join-order', { id: 5, token: 'right' })).toEqual({ ok: true });
    expect(orderService.hasAccess).toHaveBeenLastCalledWith(5, 'right');
  });

  it('DB xətasında ack "server" qaytarır (klient asılı qalmır)', async () => {
    const c = await connected(newClient());
    orderService.hasAccess.mockRejectedValueOnce(new Error('db'));
    expect(await emitAck(c, 'join-order', { id: 5, token: 't' })).toEqual({ ok: false, error: 'server' });
  });

  it('qoşulan müştəri yalnız status və ID alır — telefon, ad, token və qeyd SIZMIR', async () => {
    orderService.hasAccess.mockResolvedValue(true);
    const c = await connected(newClient());
    await emitAck(c, 'join-order', { id: 5, token: 'ok' });
    const received = once(c, 'order-status-updated');
    emit.emitOrderStatusUpdated({ id: 5, status: 'READY', phone: '+994501112233', customer_name: 'Ali', access_token: 'secret', note: 'gizli' });
    const payload = await received;
    expect(payload).toMatchObject({ id: 5, status: 'READY' });
    expect(Object.keys(payload).sort()).toEqual(['_ack', '_eid', 'id', 'status']);
  });

  it('otağa qoşulmayan (tokensiz) müştəri başqasının sifariş hadisəsini almır', async () => {
    const outsider = await connected(newClient());
    let got = false;
    outsider.on('order-status-updated', () => { got = true; });
    emit.emitOrderStatusUpdated({ id: 5, status: 'READY' });
    await sleep(150);
    expect(got).toBe(false);
  });

  it('masa otağına gedən order-created minimaldır (digər masadaşlar telefon/token görmür)', async () => {
    const c = await connected(newClient('', { query: { table: 't1' } }));
    const received = once(c, 'order-created');
    emit.emitOrderCreated({ id: 9, status: 'NEW', table_code: 't1', phone: '+994', access_token: 'secret', customer_name: 'Ali' });
    const payload = await received;
    expect(Object.keys(payload).sort()).toEqual(['_eid', 'id', 'status', 'table_code']);
  });
});

describe('admin namespace', () => {
  it('cookie olmadan və etibarsız cookie ilə qoşulmaq olmur', async () => {
    await expect(connected(newClient('/admin'))).rejects.toThrow(/Giriş tələb olunur/);
    await expect(connected(newClient('/admin', { extraHeaders: { cookie: 'qrmenu_token=bad' } }))).rejects.toThrow(/etibarsızdır/);
  });

  it('admin tam sifariş məlumatını alır və hər hadisənin unikal _eid-i var', async () => {
    const admin = await connected(newClient('/admin', { extraHeaders: { cookie: 'qrmenu_token=good' } }));
    const ids = [];
    admin.on('order-created', (o) => { ids.push(o._eid); });
    const first = once(admin, 'order-created');
    emit.emitOrderCreated({ id: 1, status: 'NEW', phone: '+994501112233', customer_name: 'Ali' });
    const payload = await first;
    expect(payload).toMatchObject({ id: 1, phone: '+994501112233' });
    emit.emitOrderCreated({ id: 2, status: 'NEW' });
    await sleep(100);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('kritik hadisə _ack işarəsi daşıyır; hamı təsdiq edəndə "acked_all", təsdiq gəlməyəndə "missing_ack" artır', async () => {
    await sleep(400); // əvvəlki testlərdən qalan ack taymerləri bitsin ki, sayğaclar yalnız bu testi əks etdirsin
    const acking = await connected(newClient('/admin', { extraHeaders: { cookie: 'qrmenu_token=good' } }));
    acking.on('notification-created', (n) => {
      expect(n._ack).toBe(true);
      acking.emit('event-ack', n._eid);
    });
    const before = emit.getSocketStats();
    emit.emitNotificationCreated({ id: 1, type: 'order_created', title: 'x' });
    await sleep(450); // 250ms ack timeout
    expect(emit.getSocketStats().acked_all).toBe(before.acked_all + 1);
    expect(emit.getSocketStats().missing_ack).toBe(before.missing_ack);

    const silent = await connected(newClient('/admin', { extraHeaders: { cookie: 'qrmenu_token=good' } }));
    silent.on('notification-created', () => {}); // təsdiq göndərmir
    const mid = emit.getSocketStats();
    emit.emitNotificationCreated({ id: 2, type: 'order_created', title: 'y' });
    await sleep(450);
    expect(emit.getSocketStats().missing_ack).toBe(mid.missing_ack + 1);
  });

  it('qeyri-kritik hadisələr (menyu) təsdiq tələb etmir və sayğaca düşmür', async () => {
    const c = await connected(newClient());
    const got = once(c, 'product-updated');
    const before = emit.getSocketStats().critical_sent;
    emit.emitProductUpdated({ id: 1 }, 'updated');
    const payload = await got;
    expect(payload._ack).toBeUndefined();
    expect(payload._eid).toBeTruthy();
    expect(emit.getSocketStats().critical_sent).toBe(before);
  });

  it('gizlədilən məhsul müştəri ekranlarından silinir (deleted), admin isə tam məlumatı alır', async () => {
    const customer = await connected(newClient());
    const admin = await connected(newClient('/admin', { extraHeaders: { cookie: 'qrmenu_token=good' } }));
    const forCustomer = once(customer, 'product-updated');
    const forAdmin = once(admin, 'product-updated');
    emit.emitProductUpdated({ id: 3, name: 'Gizli', price: 5, is_visible: false }, 'updated');
    expect(await forCustomer).toMatchObject({ product: { id: 3 }, action: 'deleted' });
    expect((await forCustomer).product.name).toBeUndefined();
    expect(await forAdmin).toMatchObject({ product: { id: 3, name: 'Gizli' }, action: 'updated' });
  });

  it('kimsə onlayn deyilsə itirilən bir şey yoxdur — missing_ack artmır', async () => {
    const before = emit.getSocketStats();
    emit.emitOrderCreated({ id: 50, status: 'NEW' });
    await sleep(450);
    expect(emit.getSocketStats().missing_ack).toBe(before.missing_ack);
  });

  it('sistem xətası bildirişi ofisiant/mətbəxə deyil, yalnız sahib/menecerə gedir', async () => {
    const owner = await connected(newClient('/admin', { extraHeaders: { cookie: 'qrmenu_token=good' } }));
    const got = jest.fn();
    owner.on('notification-created', (n) => { got(n.type); owner.emit('event-ack', n._eid); });
    emit.emitNotificationCreated({ id: 3, type: 'system_error', title: 'z' });
    emit.emitNotificationCreated({ id: 4, type: 'call_waiter', title: 'w' });
    await sleep(150);
    expect(got.mock.calls.map((c) => c[0]).sort()).toEqual(['call_waiter', 'system_error']); // OWNER hər ikisini görür
  });
});

describe('bağlantı bərpası', () => {
  it('qısa kəsilmədən sonra klient bərpa olunur (recovered) və itirilmiş hadisəni alır, otaq üzvlüyü saxlanır', async () => {
    orderService.hasAccess.mockResolvedValue(true);
    const c = await connected(newClient());
    await emitAck(c, 'join-order', { id: 7, token: 'ok' });
    const received = [];
    c.on('order-status-updated', (o) => received.push(o));

    // Bərpa üçün klientin ən azı bir hadisə (offset) almış olması lazımdır — real klient menyu hadisələrini artıq alır
    const first = once(c, 'restaurant-updated');
    emit.emitRestaurantUpdated({ name: 'R' });
    await first;

    const reconnected = once(c, 'connect');
    c.io.engine.close(); // şəbəkə kəsildi (transport bağlandı)
    await sleep(5);
    emit.emitOrderStatusUpdated({ id: 7, status: 'PREPARING' }); // klient oflayn olarkən
    await reconnected;
    await sleep(100);

    expect(c.recovered).toBe(true);
    expect(received.map((o) => o.status)).toEqual(['PREPARING']);
    // bərpadan sonrakı yeni hadisə də gəlir (otaq üzvlüyü itməyib)
    emit.emitOrderStatusUpdated({ id: 7, status: 'READY' });
    await sleep(100);
    expect(received.map((o) => o.status)).toEqual(['PREPARING', 'READY']);
  });
});
