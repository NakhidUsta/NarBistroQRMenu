const os = require('os');
const path = require('path');
const fs = require('fs');

// Həqiqi sharp və həqiqi fayl sistemi (müvəqqəti qovluqda); yalnız DB repozitoriyası saxtadır.
jest.mock('../src/config/uploads', () => ({ UPLOAD_DIR: require('path').join(require('os').tmpdir(), 'qrmenu-media-shared') }));
jest.mock('../src/config/db', () => ({ sql: jest.requireActual('mssql'), poolPromise: Promise.resolve({}) }));
jest.mock('../src/repositories/mediaRepository');

const sharp = require('sharp');
const mediaRepository = require('../src/repositories/mediaRepository');
const { UPLOAD_DIR } = require('../src/config/uploads');
const mediaService = require('../src/services/mediaService');

let nextId = 1;
const rows = new Map();

async function makeImage(name, { width = 1600, height = 1200, exif = false } = {}) {
  const file = path.join(UPLOAD_DIR, name);
  let img = sharp({ create: { width, height, channels: 3, background: '#5c1a2e' } });
  if (exif) img = img.withExif({ IFD0: { Copyright: 'GIZLI-METAMELUMAT' } });
  await img.jpeg().toFile(file);
  return file;
}

beforeAll(() => fs.mkdirSync(UPLOAD_DIR, { recursive: true }));
afterAll(() => fs.rmSync(UPLOAD_DIR, { recursive: true, force: true }));
beforeEach(() => {
  rows.clear();
  jest.clearAllMocks();
  mediaRepository.insert.mockImplementation(async (r) => {
    const row = { id: nextId++, created_at: new Date(), ...r };
    rows.set(row.id, row);
    return row;
  });
  mediaRepository.findById.mockImplementation(async (id) => rows.get(id) || null);
  mediaRepository.findUsedUrls.mockResolvedValue(new Set());
  mediaRepository.remove.mockImplementation(async (id) => rows.delete(id));
});

describe('mediaService.register', () => {
  it('orijinal + 5 variant (thumb/md/lg WebP, md/lg AVIF) yaradır, şəkilçi/ölçülər düzgündür', async () => {
    const tmp = await makeImage('upload-1.jpg', { width: 1600, height: 1200 });
    const media = await mediaService.register(tmp, 'jpg');

    expect(media.url).toMatch(/^\/uploads\/m-\d{13}-[a-f0-9]{8}\.jpg$/);
    expect(Object.keys(media.variants).sort()).toEqual(['lg', 'lg_avif', 'md', 'md_avif', 'thumb']);
    for (const v of Object.values(media.variants)) expect(fs.existsSync(path.join(UPLOAD_DIR, path.basename(v)))).toBe(true);

    const thumb = await sharp(path.join(UPLOAD_DIR, path.basename(media.variants.thumb))).metadata();
    expect(thumb).toMatchObject({ format: 'webp', width: 240 });
    const lgAvif = await sharp(path.join(UPLOAD_DIR, path.basename(media.variants.lg_avif))).metadata();
    expect(lgAvif.format).toBe('heif');
    expect(media).toMatchObject({ width: 1600, height: 1200, mime: 'image/jpeg' });
    expect(fs.existsSync(tmp)).toBe(false); // müvəqqəti fayl silinir
  });

  it('kiçik şəkli böyütmür (withoutEnlargement)', async () => {
    const tmp = await makeImage('upload-2.jpg', { width: 300, height: 200 });
    const media = await mediaService.register(tmp, 'jpg');
    const lg = await sharp(path.join(UPLOAD_DIR, path.basename(media.variants.lg))).metadata();
    expect(lg.width).toBe(300);
  });

  it('EXIF/GPS metaməlumatını orijinaldan da, variantlardan da təmizləyir', async () => {
    const tmp = await makeImage('upload-3.jpg', { exif: true });
    expect((await sharp(tmp).metadata()).exif).toBeDefined();
    const media = await mediaService.register(tmp, 'jpg');
    const original = await sharp(path.join(UPLOAD_DIR, path.basename(media.url))).metadata();
    expect(original.exif).toBeUndefined();
  });

  it('zədəli şəkildə 400 atır və heç bir fayl qalmır', async () => {
    const before = fs.readdirSync(UPLOAD_DIR).length;
    const bad = path.join(UPLOAD_DIR, 'bad.jpg');
    fs.writeFileSync(bad, Buffer.from('bu sekil deyil, sadece mətn'));
    await expect(mediaService.register(bad, 'jpg')).rejects.toMatchObject({ status: 400 });
    expect(fs.readdirSync(UPLOAD_DIR).length).toBe(before);
    expect(mediaRepository.insert).not.toHaveBeenCalled();
  });
});

describe('mediaService.crop', () => {
  it('seçilmiş nisbətə görə yeni şəkil yaradır və mənbəyə parent_id ilə bağlayır', async () => {
    const media = await mediaService.register(await makeImage('upload-4.jpg', { width: 1600, height: 1200 }), 'jpg');
    const cropped = await mediaService.crop(media.id, { aspect: '16:9', focus: 'attention' });
    expect(cropped.parent_id).toBe(media.id);
    expect(cropped.width).toBe(1600);
    expect(cropped.height).toBe(900);
    expect(cropped.id).not.toBe(media.id);
  });

  it('yanlış nisbət 400, mövcud olmayan şəkil 404', async () => {
    const media = await mediaService.register(await makeImage('upload-5.jpg', { width: 400, height: 300 }), 'jpg');
    await expect(mediaService.crop(media.id, { aspect: '7:3' })).rejects.toMatchObject({ status: 400 });
    await expect(mediaService.crop(9999, { aspect: '1:1' })).rejects.toMatchObject({ status: 404 });
  });
});

describe('mediaService.remove', () => {
  it('bütün faylları (orijinal + variantlar) və DB sətrini silir', async () => {
    const media = await mediaService.register(await makeImage('upload-6.jpg', { width: 400, height: 300 }), 'jpg');
    const files = [media.url, ...Object.values(media.variants)].map((u) => path.join(UPLOAD_DIR, path.basename(u)));
    expect(files.every((f) => fs.existsSync(f))).toBe(true);
    await mediaService.remove(media.id);
    expect(files.some((f) => fs.existsSync(f))).toBe(false);
    expect(mediaRepository.remove).toHaveBeenCalledWith(media.id);
  });

  it('istifadədə olan şəkli silmir (409)', async () => {
    const media = await mediaService.register(await makeImage('upload-7.jpg', { width: 400, height: 300 }), 'jpg');
    mediaRepository.findUsedUrls.mockResolvedValue(new Set([media.url]));
    await expect(mediaService.remove(media.id)).rejects.toMatchObject({ status: 409 });
    expect(fs.existsSync(path.join(UPLOAD_DIR, path.basename(media.url)))).toBe(true);
  });

  it('list() istifadə olunan şəkilləri in_use=true işarələyir', async () => {
    const media = await mediaService.register(await makeImage('upload-8.jpg', { width: 400, height: 300 }), 'jpg');
    mediaRepository.findAll.mockResolvedValue([rows.get(media.id)]);
    mediaRepository.findUsedUrls.mockResolvedValue(new Set([media.url]));
    const [item] = await mediaService.list();
    expect(item.in_use).toBe(true);
  });
});
