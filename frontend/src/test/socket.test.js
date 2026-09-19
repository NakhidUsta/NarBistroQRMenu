import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    ordersApi: { get: vi.fn(), create: vi.fn(), quote: vi.fn(), list: vi.fn(), updateStatus: vi.fn() },
    categoriesApi: { list: vi.fn() },
    productsApi: { list: vi.fn() },
    allergensApi: { list: vi.fn() },
    ingredientsApi: { list: vi.fn() },
  }
})

import { ordersApi, categoriesApi, productsApi, allergensApi, ingredientsApi } from '../lib/api'
import { alreadySeen, resetSeenEvents } from '../lib/eventDedupe'
import { listen, watchReconnect } from '../lib/socketBindings'
import { publicSocket, RECONNECT_OPTIONS, joinOrder } from '../lib/socket'
import { useMenuStore } from '../store/menuStore'
import { useOrderStore } from '../store/orderStore'

// Minimal socket əvəzi: on/emit + əl ilə hadisə yaymaq
function fakeSocket() {
  const handlers = {}
  return {
    handlers,
    recovered: false,
    emit: vi.fn(),
    on(event, fn) { (handlers[event] ||= []).push(fn) },
    fire(event, ...args) { (handlers[event] || []).forEach((fn) => fn(...args)) },
  }
}

beforeEach(() => {
  resetSeenEvents()
  vi.clearAllMocks()
})

describe('eventDedupe', () => {
  it('eyni _eid ikinci dəfə "artıq görülüb" sayılır, _eid-siz hadisələr həmişə yeni', () => {
    expect(alreadySeen('a')).toBe(false)
    expect(alreadySeen('a')).toBe(true)
    expect(alreadySeen('b')).toBe(false)
    expect(alreadySeen(undefined)).toBe(false)
    expect(alreadySeen(undefined)).toBe(false)
  })

  it('yaddaş məhduddur: 500-dən sonra ən köhnə unudulur', () => {
    for (let i = 0; i < 501; i++) alreadySeen(`e${i}`)
    expect(alreadySeen('e0')).toBe(false) // unudulub
    expect(alreadySeen('e500')).toBe(true)
  })
})

describe('listen (təsdiq + təkrar qorunması)', () => {
  it('handler-ə servis sahələri olmadan təmiz payload verir', () => {
    const s = fakeSocket()
    const handler = vi.fn()
    listen(s, 'restaurant-updated', handler)
    s.fire('restaurant-updated', { name: 'R', _eid: 'e1' })
    expect(handler).toHaveBeenCalledWith({ name: 'R' })
  })

  it('kritik hadisə (_ack) üçün serverə event-ack göndərir; qeyri-kritik üçün göndərmir', () => {
    const s = fakeSocket()
    listen(s, 'order-created', vi.fn())
    listen(s, 'product-updated', vi.fn())
    s.fire('order-created', { id: 1, _eid: 'x1', _ack: true })
    expect(s.emit).toHaveBeenCalledWith('event-ack', 'x1')
    s.emit.mockClear()
    s.fire('product-updated', { product: {}, _eid: 'x2' })
    expect(s.emit).not.toHaveBeenCalled()
  })

  it('eyni hadisə (eyni _eid) təkrar gələndə handler yalnız bir dəfə işləyir, amma təsdiq yenə göndərilir', () => {
    const s = fakeSocket()
    const handler = vi.fn()
    listen(s, 'order-status-updated', handler)
    const payload = { id: 5, status: 'READY', _eid: 'dup', _ack: true }
    s.fire('order-status-updated', payload)
    s.fire('order-status-updated', payload)
    expect(handler).toHaveBeenCalledTimes(1)
    expect(s.emit).toHaveBeenCalledTimes(2)
  })

  it('fərqli _eid-li eyni məzmunlu hadisələr ayrı-ayrı işlənir', () => {
    const s = fakeSocket()
    const handler = vi.fn()
    listen(s, 'x', handler)
    s.fire('x', { id: 1, _eid: 'a' })
    s.fire('x', { id: 1, _eid: 'b' })
    expect(handler).toHaveBeenCalledTimes(2)
  })
})

describe('watchReconnect (bərpada sinxronizasiya)', () => {
  it('ilk qoşulmada işləmir; sonrakı qoşulmada bərpa olunmayıbsa (recovered=false) serverdən yeniləyir', () => {
    const s = fakeSocket()
    const resync = vi.fn()
    watchReconnect(s, resync)
    s.fire('connect')
    expect(resync).not.toHaveBeenCalled()
    s.fire('connect')
    expect(resync).toHaveBeenCalledTimes(1)
  })

  it('server itirilmiş hadisələri özü bərpa edibsə (recovered=true) lazımsız yükləmə yoxdur', () => {
    const s = fakeSocket()
    const resync = vi.fn()
    watchReconnect(s, resync)
    s.fire('connect')
    s.recovered = true
    s.fire('connect')
    expect(resync).not.toHaveBeenCalled()
  })
})

describe('yenidən qoşulma konfiqurasiyası', () => {
  it('sonsuz cəhd, eksponensial geri çəkilmə (1s→30s) və jitter aktivdir', () => {
    expect(RECONNECT_OPTIONS).toMatchObject({ reconnection: true, reconnectionAttempts: Infinity, reconnectionDelay: 1000, reconnectionDelayMax: 30000, randomizationFactor: 0.5 })
    expect(publicSocket.io.reconnectionDelay()).toBe(1000)
    expect(publicSocket.io.reconnectionDelayMax()).toBe(30000)
  })
})

describe('joinOrder (token ilə, bərpada təkrar)', () => {
  it('token olmadan heç nə etmir; bağlantı qurulanda otağa token ilə qoşulur; hər yenidən qoşulmada təkrarlayır', () => {
    const spy = vi.spyOn(publicSocket, 'emit').mockImplementation(() => publicSocket)
    joinOrder(15, undefined)
    publicSocket.emitReserved('connect')
    expect(spy).not.toHaveBeenCalledWith('join-order', expect.anything(), expect.anything())

    joinOrder(15, 'tok15')
    expect(spy).not.toHaveBeenCalled() // hələ bağlı deyil
    publicSocket.emitReserved('connect')
    expect(spy).toHaveBeenCalledWith('join-order', { id: 15, token: 'tok15' }, expect.any(Function))

    spy.mockClear()
    publicSocket.emitReserved('connect') // şəbəkə kəsilib qayıtdı
    expect(spy).toHaveBeenCalledWith('join-order', { id: 15, token: 'tok15' }, expect.any(Function))
    spy.mockRestore()
  })
})

describe('bərpa zamanı arxa plan yükləməsi', () => {
  it('menuStore.fetchAll(silent): skeleton göstərilmir və xəta mövcud menyunu silmir', async () => {
    useMenuStore.setState({ status: 'ready', products: [{ id: 1 }], categories: [{ id: 1 }] })
    categoriesApi.list.mockRejectedValue(new Error('offline'))
    productsApi.list.mockResolvedValue([])
    allergensApi.list.mockResolvedValue([])
    ingredientsApi.list.mockResolvedValue([])
    await useMenuStore.getState().fetchAll(undefined, { silent: true })
    expect(useMenuStore.getState().status).toBe('ready')
    expect(useMenuStore.getState().products).toEqual([{ id: 1 }])
  })

  it('menuStore.fetchAll (adi) xətada error vəziyyətinə keçir', async () => {
    categoriesApi.list.mockRejectedValue(new Error('x'))
    productsApi.list.mockResolvedValue([])
    allergensApi.list.mockResolvedValue([])
    ingredientsApi.list.mockResolvedValue([])
    await useMenuStore.getState().fetchAll()
    expect(useMenuStore.getState().status).toBe('error')
  })

  it('refreshCurrentOrder açıq sifarişin statusunu serverdən təzələyir; xəta olarsa köhnə vəziyyət qalır', async () => {
    ordersApi.get.mockResolvedValueOnce({ id: 5, status: 'NEW' })
    await useOrderStore.getState().fetchOrder(5, 'tok')
    ordersApi.get.mockResolvedValueOnce({ id: 5, status: 'READY' })
    await useOrderStore.getState().refreshCurrentOrder()
    expect(ordersApi.get).toHaveBeenLastCalledWith(5, 'tok')
    expect(useOrderStore.getState().currentOrder.status).toBe('READY')
    ordersApi.get.mockRejectedValueOnce(new Error('offline'))
    expect(await useOrderStore.getState().refreshCurrentOrder()).toBeNull()
    expect(useOrderStore.getState().currentOrder.status).toBe('READY')
  })
})
