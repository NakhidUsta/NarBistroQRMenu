// Məhsulların sərbəst mətn tərkibini ("a, b, c") standart komponent kataloquna köçürür (bir dəfəlik, təkrar işlədilə bilər):
//   npm run migrate:ingredients                # köçür
//   npm run migrate:ingredients -- --dry-run   # nəyin yaranacağını göstər
// Artıq kataloq əlaqəsi olan məhsullara toxunmur. Köhnə mətn sütunları geriyə uyğunluq üçün saxlanılır.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { poolPromise, sql } = require('../src/config/db');
const ingredientRepository = require('../src/repositories/ingredientRepository');
const { parseIngredients } = require('../src/utils/ingredientText');

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const pool = await poolPromise;

  const products = (await pool.request().query(`
    SELECT id, name, ingredients, ingredients_en, ingredients_ru
    FROM products p
    WHERE ingredients IS NOT NULL AND LTRIM(RTRIM(ingredients)) <> ''
      AND NOT EXISTS (SELECT 1 FROM product_ingredients pi WHERE pi.product_id = p.id)
    ORDER BY id
  `)).recordset;

  if (!products.length) return console.log('Köçürüləcək məhsul yoxdur.');

  let created = 0;
  let linked = 0;
  for (const product of products) {
    const items = parseIngredients(product);
    console.log(`${dryRun ? '[quru] ' : ''}#${product.id} ${product.name}: ${items.map((i) => i.name).join(' | ')}`);
    if (dryRun) continue;

    for (const [index, item] of items.entries()) {
      let ingredient = await ingredientRepository.findByName(item.name);
      if (!ingredient) {
        ingredient = await ingredientRepository.create(item);
        created += 1;
      } else if ((!ingredient.name_en && item.name_en) || (!ingredient.name_ru && item.name_ru)) {
        // mövcud komponentin boş tərcümələrini doldur (mövcud tərcümələrin üzərinə yazmır)
        ingredient = await ingredientRepository.update(ingredient.id, {
          name: ingredient.name,
          name_en: ingredient.name_en || item.name_en,
          name_ru: ingredient.name_ru || item.name_ru,
        });
      }
      await pool.request()
        .input('p', sql.Int, product.id)
        .input('i', sql.Int, ingredient.id)
        .input('s', sql.Int, index)
        .query('INSERT INTO product_ingredients (product_id, ingredient_id, sort_order) VALUES (@p, @i, @s)');
      linked += 1;
    }
  }
  console.log(dryRun ? `Quru işə salma: ${products.length} məhsul.` : `Bitdi: ${products.length} məhsul, ${created} yeni komponent, ${linked} əlaqə.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
