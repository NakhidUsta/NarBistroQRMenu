const { sql, poolPromise } = require('../config/db');

async function insert({ restaurant_id, base_name, ext, mime, width, height, size_bytes, parent_id }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('base_name', sql.NVarChar(80), base_name)
    .input('ext', sql.NVarChar(5), ext)
    .input('mime', sql.NVarChar(30), mime)
    .input('width', sql.Int, width)
    .input('height', sql.Int, height)
    .input('size_bytes', sql.Int, size_bytes)
    .input('parent_id', sql.Int, parent_id || null)
    .query(`
      INSERT INTO media (restaurant_id, base_name, ext, mime, width, height, size_bytes, parent_id)
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @base_name, @ext, @mime, @width, @height, @size_bytes, @parent_id)
    `);
  return result.recordset[0];
}

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query('SELECT * FROM media ORDER BY created_at DESC, id DESC');
  return result.recordset;
}

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query('SELECT * FROM media WHERE id = @id');
  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await poolPromise;
  await pool.request().input('id', sql.Int, id).query('UPDATE media SET parent_id = NULL WHERE parent_id = @id; DELETE FROM media WHERE id = @id');
}

// Şəkil URL-lərinin hara bağlı olduğunu yoxlamaq üçün: məhsul şəkilləri, loqo və tema (hero).
async function findUsedUrls() {
  const pool = await poolPromise;
  const products = await pool.request().query('SELECT image_url FROM products WHERE image_url IS NOT NULL');
  const restaurant = await pool.request().query('SELECT logo_url, theme FROM restaurants');
  const urls = new Set(products.recordset.map((r) => r.image_url));
  for (const r of restaurant.recordset) {
    if (r.logo_url) urls.add(r.logo_url);
    if (r.theme) {
      try {
        const t = JSON.parse(r.theme);
        if (t.hero_image_url) urls.add(t.hero_image_url);
      } catch {
        // xarab tema JSON-u istifadə yoxlamasını sındırmasın
      }
    }
  }
  return urls;
}

module.exports = { insert, findAll, findById, remove, findUsedUrls };
