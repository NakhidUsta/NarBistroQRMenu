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
jest.mock('../src/repositories/productRepository');
jest.mock('../src/repositories/allergenRepository');
jest.mock('../src/sockets/emit', () => ({ emitProductUpdated: jest.fn() }));

const productRepository = require('../src/repositories/productRepository');
const allergenRepository = require('../src/repositories/allergenRepository');
const productService = require('../src/services/productService');
const { validateProductBody } = require('../src/validators/productValidator');
const app = require('../src/app');

const base = { name: 'Pasta', price: 12, category_id: 2 };

beforeEach(() => {
  jest.clearAllMocks();
  allergenRepository.findAll.mockResolvedValue([{ id: 1, code: 'gluten' }, { id: 7, code: 'milk' }]);
  productRepository.create.mockImplementation(async (b) => ({ id: 99, ...b }));
  productRepository.update.mockImplementation(async (id, b) => ({ id, ...b }));
});

describe('productValidator (qalereya və allergenlər)', () => {
  it('düzgün qalereya və allergen ID-lərini qəbul edir', () => {
    expect(validateProductBody({ ...base, images: ['/uploads/m-1789815057513-e58f5022.jpg', 'https://cdn.x/a.jpg?w=1'], allergen_ids: [1, 7] })).toBeNull();
  });

  it.each([
    ['massiv olmayan images', { images: 'x.jpg' }],
    ['11 şəkil', { images: Array.from({ length: 11 }, (_, i) => `/uploads/a${i}.jpg`) }],
    ['javascript: linki', { images: ['javascript:alert(1)'] }],
    ['data: linki', { images: ['data:text/html,<script>1</script>'] }],
    ['nisbi/keçid linki', { images: ['/uploads/../../etc/passwd'] }],
    ['tək image_url-də javascript:', { image_url: 'javascript:alert(1)' }],
    ['mətn allergen ID-si', { allergen_ids: ['1'] }],
    ['mənfi allergen ID-si', { allergen_ids: [-1] }],
  ])('%s rədd edilir', (_, extra) => {
    expect(validateProductBody({ ...base, ...extra })).not.toBeNull();
  });

  it('images/allergen_ids verilməyibsə (köhnə klient) problem yoxdur', () => {
    expect(validateProductBody(base)).toBeNull();
  });
});

describe('productService qalereya/allergen normalizasiyası', () => {
  it('birinci şəkil əsas şəkil (image_url) olur, təkrarlar atılır', async () => {
    await productService.createProduct({ ...base, image_url: '/uploads/old.jpg', images: ['/uploads/a.jpg', ' /uploads/b.jpg ', '/uploads/a.jpg'] });
    expect(productRepository.create).toHaveBeenCalledWith(expect.objectContaining({ images: ['/uploads/a.jpg', '/uploads/b.jpg'], image_url: '/uploads/a.jpg' }));
  });

  it('boş qalereya əsas şəkli təmizləyir', async () => {
    await productService.updateProduct(5, { ...base, image_url: '/uploads/old.jpg', images: [] });
    expect(productRepository.update).toHaveBeenCalledWith(5, expect.objectContaining({ images: [], image_url: null }));
  });

  it('images verilməyibsə qalereyaya və image_url-ə toxunmur', async () => {
    await productService.updateProduct(5, { ...base, image_url: '/uploads/keep.jpg' });
    const sent = productRepository.update.mock.calls[0][1];
    expect(sent.images).toBeUndefined();
    expect(sent.image_url).toBe('/uploads/keep.jpg');
  });

  it('kataloqda olmayan allergen 400 verir və heç nə yazılmır', async () => {
    await expect(productService.createProduct({ ...base, allergen_ids: [1, 999] })).rejects.toMatchObject({ status: 400 });
    expect(productRepository.create).not.toHaveBeenCalled();
  });

  it('allergen_ids təkrarları atılır', async () => {
    await productService.updateProduct(5, { ...base, allergen_ids: [7, 7, 1] });
    expect(productRepository.update).toHaveBeenCalledWith(5, expect.objectContaining({ allergen_ids: [7, 1] }));
  });
});

describe('POST/PUT /api/products (qalereya)', () => {
  it('yanlış şəkil linki 400', async () => {
    const res = await request(app).post('/api/products').set('Cookie', cookieFor('OWNER')).send({ ...base, images: ['javascript:alert(1)'] });
    expect(res.status).toBe(400);
    expect(productRepository.create).not.toHaveBeenCalled();
  });

  it('düzgün qalereya + allergenlərlə yaradılır və cavabda qayıdır', async () => {
    const res = await request(app).post('/api/products').set('Cookie', cookieFor('MANAGER')).send({ ...base, images: ['/uploads/a.jpg', '/uploads/b.jpg'], allergen_ids: [1] });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ image_url: '/uploads/a.jpg', images: ['/uploads/a.jpg', '/uploads/b.jpg'], allergen_ids: [1] });
  });

  it('GET /api/allergens açıqdır (autentifikasiyasız)', async () => {
    const res = await request(app).get('/api/allergens');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
  });
});
