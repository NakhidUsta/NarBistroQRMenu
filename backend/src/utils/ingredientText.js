const MAX_NAME = 80;

const splitList = (text) => (text ? String(text).split(/[,•\n]/).map((s) => s.trim()).filter(Boolean) : []);

// Sərbəst mətn tərkibi ("Fettuccine, krem, parmezan") → kataloq elementləri.
// Tərcümələr yalnız EN/RU siyahısı AZ siyahısı ilə eyni sayda olduqda mövqeyə görə uyğunlaşdırılır — əks halda səhv tərcümə yazmaq əvəzinə boş qalır.
function parseIngredients({ ingredients, ingredients_en, ingredients_ru }) {
  const az = splitList(ingredients);
  const en = splitList(ingredients_en);
  const ru = splitList(ingredients_ru);
  const aligned = (list, i) => (list.length === az.length ? list[i].slice(0, MAX_NAME) : null);

  const seen = new Set();
  const out = [];
  az.forEach((name, i) => {
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name: name.slice(0, MAX_NAME), name_en: aligned(en, i), name_ru: aligned(ru, i) });
  });
  return out;
}

module.exports = { splitList, parseIngredients, MAX_NAME };
