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
jest.mock('../src/repositories/ingredientRepository');
jest.mock('../src/repositories/productRepository');
jest.mock('../src/repositories/allergenRepository');
jest.mock('../src/sockets/emit', () => ({ emitProductUpdated: jest.fn(), emitIngredientUpdated: jest.fn() }));

const ingredientRepository = require('../src/repositories/ingredientRepository');
const productRepository = require('../src/repositories/productRepository');
const { emitIngredientUpdated } = require('../src/sockets/emit');
const productService = require('../src/services/productService');
const { parseIngredients } = require('../src/utils/ingredientText');
const app = require('../src/app');

const base = { name: 'Pasta', price: 12, category_id: 2 };
const dupError = Object.assign(new Error('Violation of UNIQUE KEY'), { number: 2627 });

beforeEach(() => {
  jest.clearAllMocks();
  ingredientRepository.findAll.mockResolvedValue([{ id: 1, name: 'Süd' }, { id: 2, name: 'Un' }, { id: 3, name: 'Yumurta' }]);
  ingredientRepository.findById.mockImplementation(async (id) => (id === 1 ? { id: 1, name: 'Süd' } : null));
  productRepository.update.mockImplementation(async (id, b) => ({ id, ...b }));
});

describe('parseIngredients (mətn → kataloq)', () => {
  it('vergül, • və sətir sonuna görə bölür, boşları və təkrarları atır', () => {
    const items = parseIngredients({ ingredients: 'Süd, un • yumurta\nSÜD, ' });
    expect(items.map((i) => i.name)).toEqual(['Süd', 'un', 'yumurta']);
  });

  it('tərcümələri yalnız sayı eyni olduqda mövqeyə görə uyğunlaşdırır', () => {
    const same = parseIngredients({ ingredients: 'Süd, Un', ingredients_en: 'Milk, Flour', ingredients_ru: 'Молоко, Мука' });
    expect(same).toEqual([
      { name: 'Süd', name_en: 'Milk', name_ru: 'Молоко' },
      { name: 'Un', name_en: 'Flour', name_ru: 'Мука' },
    ]);
    const mismatch = parseIngredients({ ingredients: 'Süd, Un', ingredients_en: 'Milk, Flour, Eggs' });
    expect(mismatch.every((i) => i.name_en === null)).toBe(true);
  });

  it('boş/yoxdur mətn boş massiv verir; çox uzun ad 80 simvola kəsilir', () => {
    expect(parseIngredients({})).toEqual([]);
    expect(parseIngredients({ ingredients: 'x'.repeat(200) })[0].name).toHaveLength(80);
  });
});

describe('productService: ingredient_ids', () => {
  it('sıranı saxlayır, təkrarları atır', async () => {
    await productService.updateProduct(5, { ...base, ingredient_ids: [3, 1, 3, 2] });
    expect(productRepository.update).toHaveBeenCalledWith(5, expect.objectContaining({ ingredient_ids: [3, 1, 2] }));
  });

  it('kataloqda olmayan komponent 400', async () => {
    await expect(productService.updateProduct(5, { ...base, ingredient_ids: [1, 99] })).rejects.toMatchObject({ status: 400 });
    expect(productRepository.update).not.toHaveBeenCalled();
  });

  it('verilməyibsə toxunmur', async () => {
    await productService.updateProduct(5, base);
    expect(productRepository.update.mock.calls[0][1].ingredient_ids).toBeUndefined();
  });

  it('API: yanlış tipli ingredient_ids 400', async () => {
    const res = await request(app).post('/api/products').set('Cookie', cookieFor('OWNER')).send({ ...base, ingredient_ids: ['1'] });
    expect(res.status).toBe(400);
  });
});

describe('/api/ingredients', () => {
  it('GET açıqdır', async () => {
    const res = await request(app).get('/api/ingredients');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
  });

  it.each(['WAITER', 'KITCHEN'])('%s yaza bilməz (403), autentifikasiyasız 401', async (role) => {
    expect((await request(app).post('/api/ingredients').set('Cookie', cookieFor(role)).send({ name: 'X' })).status).toBe(403);
    expect((await request(app).put('/api/ingredients/1').set('Cookie', cookieFor(role)).send({ name: 'X' })).status).toBe(403);
    expect((await request(app).delete('/api/ingredients/1').set('Cookie', cookieFor(role))).status).toBe(403);
    expect((await request(app).post('/api/ingredients').send({ name: 'X' })).status).toBe(401);
  });

  it('MANAGER yaradır: ad kəsilir, boş tərcümə null olur, socket yayımlanır', async () => {
    ingredientRepository.create.mockImplementation(async (b) => ({ id: 10, ...b }));
    const res = await request(app).post('/api/ingredients').set('Cookie', cookieFor('MANAGER')).send({ name: '  Kərə yağı ', name_en: 'Butter', name_ru: '  ' });
    expect(res.status).toBe(201);
    expect(ingredientRepository.create).toHaveBeenCalledWith({ name: 'Kərə yağı', name_en: 'Butter', name_ru: null });
    expect(emitIngredientUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 10 }), 'created');
  });

  it('boş ad və 80-dən uzun ad 400', async () => {
    expect((await request(app).post('/api/ingredients').set('Cookie', cookieFor('OWNER')).send({ name: '   ' })).status).toBe(400);
    expect((await request(app).post('/api/ingredients').set('Cookie', cookieFor('OWNER')).send({ name: 'a'.repeat(81) })).status).toBe(400);
  });

  it('təkrar ad 409 verir (500 yox)', async () => {
    ingredientRepository.create.mockRejectedValue(dupError);
    const res = await request(app).post('/api/ingredients').set('Cookie', cookieFor('OWNER')).send({ name: 'Süd' });
    expect(res.status).toBe(409);
  });

  it('mövcud olmayan komponenti yeniləmək/silmək 404', async () => {
    expect((await request(app).put('/api/ingredients/77').set('Cookie', cookieFor('OWNER')).send({ name: 'X' })).status).toBe(404);
    expect((await request(app).delete('/api/ingredients/77').set('Cookie', cookieFor('OWNER'))).status).toBe(404);
  });

  it('məhsulda istifadə olunan komponent silinmir (409), istifadə olunmayan silinir', async () => {
    ingredientRepository.usageCount.mockResolvedValueOnce(3);
    const blocked = await request(app).delete('/api/ingredients/1').set('Cookie', cookieFor('OWNER'));
    expect(blocked.status).toBe(409);
    expect(blocked.body.error).toContain('3 məhsulda');
    expect(ingredientRepository.remove).not.toHaveBeenCalled();

    ingredientRepository.usageCount.mockResolvedValueOnce(0);
    const ok = await request(app).delete('/api/ingredients/1').set('Cookie', cookieFor('OWNER'));
    expect(ok.status).toBe(204);
    expect(ingredientRepository.remove).toHaveBeenCalledWith(1);
    expect(emitIngredientUpdated).toHaveBeenCalledWith({ id: 1 }, 'deleted');
  });

  it('yanlış ID 400', async () => {
    expect((await request(app).put('/api/ingredients/abc').set('Cookie', cookieFor('OWNER')).send({ name: 'X' })).status).toBe(400);
  });
});
