const { sql, poolPromise } = require('../config/db');

const COLUMNS = 'id, name, name_en, name_ru, created_at';

async function findAll() {
  const pool = await poolPromise;
  const result = await pool.request().query(`SELECT ${COLUMNS} FROM ingredients ORDER BY name ASC`);
  return result.recordset;
}

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query(`SELECT ${COLUMNS} FROM ingredients WHERE id = @id`);
  return result.recordset[0] || null;
}

async function findByName(name) {
  const pool = await poolPromise;
  const result = await pool.request().input('name', sql.NVarChar(80), name).query(`SELECT ${COLUMNS} FROM ingredients WHERE name = @name`);
  return result.recordset[0] || null;
}

async function create({ name, name_en, name_ru }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('name', sql.NVarChar(80), name)
    .input('name_en', sql.NVarChar(80), name_en || null)
    .input('name_ru', sql.NVarChar(80), name_ru || null)
    .query('INSERT INTO ingredients (name, name_en, name_ru) OUTPUT INSERTED.* VALUES (@name, @name_en, @name_ru)');
  return result.recordset[0];
}

async function update(id, { name, name_en, name_ru }) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(80), name)
    .input('name_en', sql.NVarChar(80), name_en || null)
    .input('name_ru', sql.NVarChar(80), name_ru || null)
    .query('UPDATE ingredients SET name = @name, name_en = @name_en, name_ru = @name_ru OUTPUT INSERTED.* WHERE id = @id');
  return result.recordset[0] || null;
}

async function usageCount(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query('SELECT COUNT(*) AS n FROM product_ingredients WHERE ingredient_id = @id');
  return result.recordset[0].n;
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request().input('id', sql.Int, id).query('DELETE FROM ingredients WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

module.exports = { findAll, findById, findByName, create, update, usageCount, remove };
