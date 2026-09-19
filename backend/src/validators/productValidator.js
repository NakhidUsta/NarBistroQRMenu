const MAX_IMAGES = 10;
// Yalnız öz yükləmələrimiz (/uploads/...) və http(s) şəkil linkləri — "javascript:" və s. rədd edilir
const IMAGE_URL = /^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/;

function validateProductBody(body) {
  const { name, price, category_id, images, allergen_ids, image_url } = body;
  if (!name || !String(name).trim()) return 'Ad tələb olunur';
  const priceNum = Number(price);
  if (!Number.isFinite(priceNum) || priceNum < 0) return 'Qiymət düzgün deyil';
  if (!Number.isInteger(Number(category_id))) return 'Kateqoriya tələb olunur';

  if (image_url && !IMAGE_URL.test(image_url)) return 'Şəkil linki düzgün deyil';
  if (images !== undefined) {
    if (!Array.isArray(images)) return 'images massiv olmalıdır';
    if (images.length > MAX_IMAGES) return `Ən çox ${MAX_IMAGES} şəkil əlavə etmək olar`;
    if (images.some((u) => typeof u !== 'string' || u.length > 500 || !IMAGE_URL.test(u))) return 'Şəkil linki düzgün deyil';
  }
  if (allergen_ids !== undefined) {
    if (!Array.isArray(allergen_ids) || allergen_ids.some((id) => !Number.isInteger(id) || id <= 0)) {
      return 'allergen_ids müsbət tam ədədlər massivi olmalıdır';
    }
  }
  return null;
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validateProductBody, validateId, MAX_IMAGES };
