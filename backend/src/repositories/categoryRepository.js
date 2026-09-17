const { sql, poolPromise } = require('../config/db');

const SELECT_COLUMNS = 'id, restaurant_id, name, name_en, name_ru, slug, sort_order, is_active, created_at';

async function findAll({ includeInactive = false } = {}) {
  const pool = await poolPromise;
  let query = `SELECT ${SELECT_COLUMNS} FROM categories`;
  if (!includeInactive) query += ' WHERE is_active = 1';
  query += ' ORDER BY sort_order ASC, id ASC';
  const result = await pool.request().query(query);
  return result.recordset;
}

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${SELECT_COLUMNS} FROM categories WHERE id = @id`);
  return result.recordset[0] || null;
}

function bindTranslations(request, body) {
  return request
    .input('name_en', sql.NVarChar(60), body.name_en || null)
    .input('name_ru', sql.NVarChar(60), body.name_ru || null);
}

async function create({ restaurant_id, name, name_en, name_ru, slug, sort_order, is_active }) {
  const pool = await poolPromise;
  const result = await bindTranslations(pool.request(), { name_en, name_ru })
    .input('restaurant_id', sql.Int, restaurant_id)
    .input('name', sql.NVarChar(60), name)
    .input('slug', sql.NVarChar(60), slug)
    .input('sort_order', sql.Int, sort_order ?? 0)
    .input('is_active', sql.Bit, is_active === false ? 0 : 1)
    .query(`
      INSERT INTO categories (restaurant_id, name, name_en, name_ru, slug, sort_order, is_active)
      OUTPUT INSERTED.*
      VALUES (@restaurant_id, @name, @name_en, @name_ru, @slug, @sort_order, @is_active)
    `);
  return result.recordset[0];
}

async function update(id, { name, name_en, name_ru, slug, sort_order, is_active }) {
  const pool = await poolPromise;
  const result = await bindTranslations(pool.request(), { name_en, name_ru })
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(60), name)
    .input('slug', sql.NVarChar(60), slug)
    .input('sort_order', sql.Int, sort_order ?? 0)
    .input('is_active', sql.Bit, is_active === false ? 0 : 1)
    .query(`
      UPDATE categories
      SET name = @name, name_en = @name_en, name_ru = @name_ru,
          slug = @slug, sort_order = @sort_order, is_active = @is_active
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM categories WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

module.exports = { findAll, findById, create, update, remove };
