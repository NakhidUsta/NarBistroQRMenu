const { sql, poolPromise } = require('../config/db');

const SELECT_COLUMNS = `
  id, name, name_en, name_ru, logo_url, phone, whatsapp, address, google_maps_link, working_hours,
  email, about_text, about_text_en, about_text_ru, instagram_link, facebook_link, tiktok_link,
  allow_tableless_orders, theme, created_at
`;

async function find(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${SELECT_COLUMNS} FROM restaurants WHERE id = @id`);
  return result.recordset[0] || null;
}

async function update(id, body) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('name', sql.NVarChar(120), body.name)
    .input('name_en', sql.NVarChar(120), body.name_en || null)
    .input('name_ru', sql.NVarChar(120), body.name_ru || null)
    .input('logo_url', sql.NVarChar(sql.MAX), body.logo_url || null)
    .input('phone', sql.NVarChar(30), body.phone || null)
    .input('whatsapp', sql.NVarChar(30), body.whatsapp || null)
    .input('address', sql.NVarChar(250), body.address || null)
    .input('google_maps_link', sql.NVarChar(sql.MAX), body.google_maps_link || null)
    .input('working_hours', sql.NVarChar(150), body.working_hours || null)
    .input('email', sql.NVarChar(150), body.email || null)
    .input('about_text', sql.NVarChar(sql.MAX), body.about_text || null)
    .input('about_text_en', sql.NVarChar(sql.MAX), body.about_text_en || null)
    .input('about_text_ru', sql.NVarChar(sql.MAX), body.about_text_ru || null)
    .input('instagram_link', sql.NVarChar(sql.MAX), body.instagram_link || null)
    .input('facebook_link', sql.NVarChar(sql.MAX), body.facebook_link || null)
    .input('tiktok_link', sql.NVarChar(sql.MAX), body.tiktok_link || null)
    .input('allow_tableless_orders', sql.Bit, body.allow_tableless_orders ? 1 : 0)
    .input('theme', sql.NVarChar(sql.MAX), body.theme || null)
    .query(`
      UPDATE restaurants
      SET name = @name, name_en = @name_en, name_ru = @name_ru, logo_url = @logo_url, phone = @phone, whatsapp = @whatsapp,
          address = @address, google_maps_link = @google_maps_link, working_hours = @working_hours,
          email = @email, about_text = @about_text, about_text_en = @about_text_en, about_text_ru = @about_text_ru,
          instagram_link = @instagram_link, facebook_link = @facebook_link, tiktok_link = @tiktok_link,
          allow_tableless_orders = @allow_tableless_orders, theme = @theme
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
  return result.recordset[0] || null;
}

module.exports = { find, update };
