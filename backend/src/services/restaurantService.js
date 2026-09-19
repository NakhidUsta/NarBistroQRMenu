const restaurantRepository = require('../repositories/restaurantRepository');
const AppError = require('../utils/AppError');
const { emitRestaurantUpdated } = require('../sockets/emit');
const { isOnlineAvailable } = require('./payments');

const DEFAULT_RESTAURANT_ID = 1;
const HEX = /^#[0-9a-fA-F]{6}$/;
const FONTS = ['Fraunces', 'Playfair Display', 'Cormorant Garamond', 'DM Serif Display', 'Times New Roman', 'Inter'];
const COLOR_KEYS = ['primary', 'background', 'button'];
const TEXT_KEYS = { hero_image_url: 500, hero_title: 120, hero_subtitle: 240, banner_text: 200, footer_text: 400 };

// Tema JSON-u yalnız icazə verilən açarlarla və təhlükəsiz dəyərlərlə saxlanılır
// (rəng — HEX, font — siyahıdan, mətn — uzunluq limiti) ki, CSS/HTML inyeksiyası mümkün olmasın.
function sanitizeTheme(input) {
  if (input == null || input === '') return null;
  let theme = input;
  if (typeof input === 'string') {
    try {
      theme = JSON.parse(input);
    } catch {
      throw new AppError(400, 'Tema JSON formatında olmalıdır');
    }
  }
  if (typeof theme !== 'object' || Array.isArray(theme)) throw new AppError(400, 'Tema obyekt olmalıdır');

  const clean = {};
  for (const key of COLOR_KEYS) {
    if (theme[key]) {
      if (!HEX.test(theme[key])) throw new AppError(400, `${key} rəngi #RRGGBB formatında olmalıdır`);
      clean[key] = theme[key];
    }
  }
  if (theme.font) {
    if (!FONTS.includes(theme.font)) throw new AppError(400, 'Font siyahıdan seçilməlidir');
    clean.font = theme.font;
  }
  for (const [key, max] of Object.entries(TEXT_KEYS)) {
    if (theme[key]) clean[key] = String(theme[key]).slice(0, max);
  }
  return JSON.stringify(clean);
}

// Onlayn ödəniş provayderi serverdə qoşulubmu (açarlar göstərilmir) — frontend yalnız bu bayrağı görür
const withPaymentInfo = (restaurant) => ({ ...restaurant, online_payment_available: isOnlineAvailable() });

async function getRestaurant() {
  const restaurant = await restaurantRepository.find(DEFAULT_RESTAURANT_ID);
  if (!restaurant) throw new AppError(404, 'Restoran tapılmadı');
  return withPaymentInfo(restaurant);
}

// Yalnız öz yükləmələrimiz (/uploads/...) və http(s) şəkil linkləri — "javascript:" və s. rədd edilir
const IMAGE_URL = /^(\/uploads\/[\w.-]+|https?:\/\/\S+)$/;

function validateImages(body) {
  for (const key of ['logo_url', 'favicon_url']) {
    if (body[key] && (typeof body[key] !== 'string' || body[key].length > 500 || !IMAGE_URL.test(body[key]))) {
      throw new AppError(400, `${key} düzgün şəkil linki deyil`);
    }
  }
}

async function updateRestaurant(body) {
  validateImages(body);
  const restaurant = await restaurantRepository.update(DEFAULT_RESTAURANT_ID, { ...body, theme: sanitizeTheme(body.theme) });
  if (!restaurant) throw new AppError(404, 'Restoran tapılmadı');
  emitRestaurantUpdated(withPaymentInfo(restaurant));
  return withPaymentInfo(restaurant);
}

module.exports = { getRestaurant, updateRestaurant, sanitizeTheme, FONTS };
