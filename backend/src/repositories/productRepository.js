const { sql, poolPromise } = require('../config/db');

const SELECT_COLUMNS = `
  id, restaurant_id, category_id, name, name_en, name_ru, description, description_en, description_ru,
  price, image_url, ingredients, ingredients_en, ingredients_ru, allergens, allergens_en, allergens_ru,
  prep_time_minutes, is_available, is_popular, sort_order,
  stock_quantity, track_inventory, created_at
`;

// Məhsulun qalereyası (images), allergen və tərkib ID-ləri (ingredient_ids — sıralı) ayrı cədvəllərdədir; oxunanda məhsula əlavə olunur.
// images[0] həmişə əsas şəkildir (products.image_url); image_url qalereyada yoxdursa (köhnə API) başa əlavə olunur.
async function attachRelations(products, productId) {
  if (!products.length) return products;
  const pool = await poolPromise;
  const run = (text, order) => {
    const request = pool.request();
    let query = text;
    if (productId) {
      request.input('id', sql.Int, productId);
      query += ' WHERE product_id = @id';
    }
    return request.query(`${query} ${order}`);
  };
  const [imageRows, allergenRows, ingredientRows] = await Promise.all([
    run('SELECT product_id, image_url FROM product_images', 'ORDER BY product_id, sort_order, id'),
    run('SELECT product_id, allergen_id FROM product_allergens', 'ORDER BY allergen_id'),
    run('SELECT product_id, ingredient_id FROM product_ingredients', 'ORDER BY product_id, sort_order, ingredient_id'),
  ]);
  const imagesBy = new Map();
  for (const r of imageRows.recordset) imagesBy.set(r.product_id, [...(imagesBy.get(r.product_id) || []), r.image_url]);
  const allergensBy = new Map();
  for (const r of allergenRows.recordset) allergensBy.set(r.product_id, [...(allergensBy.get(r.product_id) || []), r.allergen_id]);

  const ingredientsBy = new Map();
  for (const r of ingredientRows.recordset) ingredientsBy.set(r.product_id, [...(ingredientsBy.get(r.product_id) || []), r.ingredient_id]);

  return products.map((p) => {
    const gallery = imagesBy.get(p.id) || [];
    const images = p.image_url && !gallery.includes(p.image_url) ? [p.image_url, ...gallery] : gallery;
    return { ...p, images, allergen_ids: allergensBy.get(p.id) || [], ingredient_ids: ingredientsBy.get(p.id) || [] };
  });
}

async function withRelations(product) {
  if (!product) return null;
  const [withData] = await attachRelations([product], product.id);
  return withData;
}

// body.images / allergen_ids / ingredient_ids massivdirsə əlaqə cədvəlləri tam əvəz olunur; verilməyibsə toxunulmur.
async function writeRelations(transaction, productId, body) {
  if (Array.isArray(body.images)) {
    await new sql.Request(transaction).input('id', sql.Int, productId).query('DELETE FROM product_images WHERE product_id = @id');
    for (const [index, url] of body.images.entries()) {
      await new sql.Request(transaction)
        .input('id', sql.Int, productId)
        .input('url', sql.NVarChar(500), url)
        .input('sort', sql.Int, index)
        .query('INSERT INTO product_images (product_id, image_url, sort_order) VALUES (@id, @url, @sort)');
    }
  }
  if (Array.isArray(body.ingredient_ids)) {
    await new sql.Request(transaction).input('id', sql.Int, productId).query('DELETE FROM product_ingredients WHERE product_id = @id');
    for (const [index, ingredientId] of body.ingredient_ids.entries()) {
      await new sql.Request(transaction)
        .input('id', sql.Int, productId)
        .input('ingredient', sql.Int, ingredientId)
        .input('sort', sql.Int, index)
        .query('INSERT INTO product_ingredients (product_id, ingredient_id, sort_order) VALUES (@id, @ingredient, @sort)');
    }
  }
  if (Array.isArray(body.allergen_ids)) {
    await new sql.Request(transaction).input('id', sql.Int, productId).query('DELETE FROM product_allergens WHERE product_id = @id');
    for (const allergenId of body.allergen_ids) {
      await new sql.Request(transaction)
        .input('id', sql.Int, productId)
        .input('allergen', sql.Int, allergenId)
        .query('INSERT INTO product_allergens (product_id, allergen_id) VALUES (@id, @allergen)');
    }
  }
}

async function inTransaction(work) {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await work(transaction);
    await transaction.commit();
    return result;
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function findAll({ category_id, includeUnavailable = true } = {}) {
  const pool = await poolPromise;
  const request = pool.request();
  let query = `SELECT ${SELECT_COLUMNS} FROM products`;
  const conditions = [];

  if (category_id) {
    conditions.push('category_id = @category_id');
    request.input('category_id', sql.Int, category_id);
  }
  if (!includeUnavailable) {
    conditions.push('is_available = 1');
  }
  if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY sort_order ASC, id ASC';

  const result = await request.query(query);
  return attachRelations(result.recordset);
}

async function findById(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT ${SELECT_COLUMNS} FROM products WHERE id = @id`);
  return withRelations(result.recordset[0]);
}

function bindBody(request, body) {
  return request
    .input('category_id', sql.Int, body.category_id)
    .input('name', sql.NVarChar(120), body.name)
    .input('name_en', sql.NVarChar(120), body.name_en || null)
    .input('name_ru', sql.NVarChar(120), body.name_ru || null)
    .input('description', sql.NVarChar(sql.MAX), body.description || null)
    .input('description_en', sql.NVarChar(sql.MAX), body.description_en || null)
    .input('description_ru', sql.NVarChar(sql.MAX), body.description_ru || null)
    .input('price', sql.Decimal(10, 2), Number(body.price))
    .input('image_url', sql.NVarChar(sql.MAX), body.image_url || null)
    .input('ingredients', sql.NVarChar(sql.MAX), body.ingredients || null)
    .input('ingredients_en', sql.NVarChar(sql.MAX), body.ingredients_en || null)
    .input('ingredients_ru', sql.NVarChar(sql.MAX), body.ingredients_ru || null)
    .input('allergens', sql.NVarChar(sql.MAX), body.allergens || null)
    .input('allergens_en', sql.NVarChar(sql.MAX), body.allergens_en || null)
    .input('allergens_ru', sql.NVarChar(sql.MAX), body.allergens_ru || null)
    .input('prep_time_minutes', sql.Int, body.prep_time_minutes || null)
    .input('is_available', sql.Bit, body.is_available === false ? 0 : 1)
    .input('is_popular', sql.Bit, body.is_popular ? 1 : 0)
    .input('sort_order', sql.Int, body.sort_order ?? 0)
    .input('stock_quantity', sql.Int, body.stock_quantity === '' || body.stock_quantity == null ? null : Number(body.stock_quantity))
    .input('track_inventory', sql.Bit, body.track_inventory ? 1 : 0);
}

async function create(body) {
  const product = await inTransaction(async (transaction) => {
    const request = bindBody(new sql.Request(transaction), body)
      .input('restaurant_id', sql.Int, body.restaurant_id);
    const result = await request.query(`
      INSERT INTO products (
        restaurant_id, category_id, name, name_en, name_ru, description, description_en, description_ru,
        price, image_url, ingredients, ingredients_en, ingredients_ru, allergens, allergens_en, allergens_ru,
        prep_time_minutes, is_available, is_popular, sort_order, stock_quantity, track_inventory
      )
      OUTPUT INSERTED.*
      VALUES (
        @restaurant_id, @category_id, @name, @name_en, @name_ru, @description, @description_en, @description_ru,
        @price, @image_url, @ingredients, @ingredients_en, @ingredients_ru, @allergens, @allergens_en, @allergens_ru,
        @prep_time_minutes, @is_available, @is_popular, @sort_order, @stock_quantity, @track_inventory
      )
    `);
    const created = result.recordset[0];
    await writeRelations(transaction, created.id, body);
    return created;
  });
  return withRelations(product);
}

async function update(id, body) {
  const product = await inTransaction(async (transaction) => {
    const request = bindBody(new sql.Request(transaction), body).input('id', sql.Int, id);
    const result = await request.query(`
      UPDATE products
      SET category_id = @category_id, name = @name, name_en = @name_en, name_ru = @name_ru,
          description = @description, description_en = @description_en, description_ru = @description_ru,
          price = @price, image_url = @image_url,
          ingredients = @ingredients, ingredients_en = @ingredients_en, ingredients_ru = @ingredients_ru,
          allergens = @allergens, allergens_en = @allergens_en, allergens_ru = @allergens_ru,
          prep_time_minutes = @prep_time_minutes, is_available = @is_available,
          is_popular = @is_popular, sort_order = @sort_order,
          stock_quantity = @stock_quantity, track_inventory = @track_inventory
      OUTPUT INSERTED.*
      WHERE id = @id
    `);
    const updated = result.recordset[0] || null;
    if (updated) await writeRelations(transaction, id, body);
    return updated;
  });
  return withRelations(product);
}

async function adjustStock(id, changeQty) {
  const pool = await poolPromise;
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    const result = await new sql.Request(transaction)
      .input('id', sql.Int, id)
      .input('qty', sql.Int, changeQty)
      .query(`
        UPDATE products
        SET stock_quantity = ISNULL(stock_quantity, 0) + @qty
        OUTPUT INSERTED.*
        WHERE id = @id
      `);
    const product = result.recordset[0];
    if (product) {
      await new sql.Request(transaction)
        .input('product_id', sql.Int, id)
        .input('change_qty', sql.Int, changeQty)
        .input('reason', sql.NVarChar(30), 'manual_adjustment')
        .query(`INSERT INTO stock_movements (product_id, change_qty, reason) VALUES (@product_id, @change_qty, @reason)`);
    }
    await transaction.commit();
    return withRelations(product);
  } catch (err) {
    await transaction.rollback();
    throw err;
  }
}

async function setAvailability(id, isAvailable) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .input('is_available', sql.Bit, isAvailable ? 1 : 0)
    .query('UPDATE products SET is_available = @is_available OUTPUT INSERTED.* WHERE id = @id');
  return withRelations(result.recordset[0]);
}

async function remove(id) {
  const pool = await poolPromise;
  const result = await pool.request()
    .input('id', sql.Int, id)
    .query('DELETE FROM products WHERE id = @id');
  return result.rowsAffected[0] > 0;
}

module.exports = { findAll, findById, create, update, setAvailability, adjustStock, remove };
