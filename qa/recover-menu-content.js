// Bərpa skripti (QA sessiyasında yanlışlıqla sıfırlanan `qr_menu` bazasını doldurmaq üçün, BİR DƏFƏLİK).
// İstifadəçinin əvvəlki sessiyada tələb etdiyi kimi: restoran brendinqi + 15 yeni kateqoriya + 50 yeni məhsul.
// Parametrli sorğular (NVARCHAR) istifadə edir ki, Azərbaycan hərfləri/apostroflar problemsiz yazılsın.
const path = require('path');
const backend = path.resolve(__dirname, '..', 'backend');
require(path.join(backend, 'node_modules', 'dotenv')).config({ path: path.join(backend, '.env') });
const sql = require(path.join(backend, 'node_modules', 'mssql'));

async function connect() {
  return new sql.ConnectionPool({
    server: process.env.DB_SERVER, database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
  }).connect();
}

const slugify = (s) => s.toLowerCase()
  .replace(/ə/g, 'e').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ç/g, 'c').replace(/ğ/g, 'g')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// Real qorunmuş adlar/qiymətlər (bu sessiyada admin paneldə görülüb) + oxşar keyfiyyətdə yenidən yaradılan 44 məhsul.
const NEW_CATEGORIES = [
  'Salatlar', 'Şorbalar', 'Soyuq qəlyanaltılar', 'İsti qəlyanaltılar', 'Pizzalar', 'Pasta',
  'Burgerlər', 'Qrill və Kabablar', 'Milli yeməklər', 'Dəniz məhsulları', 'Steyklər',
  'Səhər yeməkləri', 'Şirniyyatlar', 'Qəhvə və çay', 'Limonad və kokteyllər',
];

const IMG = (q) => `https://images.unsplash.com/${q}?auto=format&fit=crop&w=800&q=80`;

// [ad, kateqoriya, qiymət, təsvir, tərkib, şəkil]
const PRODUCTS = [
  // Salatlar (real qorunub)
  ['Sezar salatı', 'Salatlar', 14, 'Xırtıldayan romen salatı, qrilldə toyuq filesi, parmezan və ev sousu.', 'Roman kahı, toyuq döş əti, parmezan, krutonlar, sezar sousu', IMG('photo-1550304943-4f24f54ddde9')],
  ['Yunan salatı', 'Salatlar', 12, 'Pomidor, xiyar, zeytun, bibər və feta pendiri, zeytun yağı ilə.', 'Pomidor, xiyar, qırmızı soğan, zeytun, feta pendiri, zeytun yağı', IMG('photo-1540420773420-3366772f4999')],
  ['Rukola və pendir salatı', 'Salatlar', 13, 'Rukola, albalı pomidor, parmezan lövhələri və balzamik sousu.', 'Rukola, albalı pomidor, parmezan, balzamik sirkə', IMG('photo-1512621776951-a57141f2eefd')],
  ['Toyuqlu Kobb salatı', 'Salatlar', 15, 'Qrilldə toyuq, bekon, yumurta, avokado və mavi pendir sousu.', 'Toyuq döş əti, bekon, yumurta, avokado, mavi pendir', IMG('photo-1546793665-c74683f339c1')],
  // Şorbalar (real qorunub)
  ['Mərcimək şorbası', 'Şorbalar', 8, 'Qırmızı mərcimək, yerkökü və zirə ilə qatı şorba, limon ilə.', 'Qırmızı mərcimək, yerkökü, soğan, zirə, limon', IMG('photo-1547592180-85f173990554')],
  ['Göbələk krem şorbası', 'Şorbalar', 10, 'İpək kimi krem-şorba, meşə göbələyi və təzə cəfəri ilə.', 'Göbələk, krem, soğan, cəfəri', IMG('photo-1547592166-23ac45744acd')],
  ['Pomidor-reyhan şorbası', 'Şorbalar', 9, 'Qovrulmuş pomidor, reyhan və krem ilə hazırlanmış isti şorba.', 'Pomidor, reyhan, krem, sarımsaq', IMG('photo-1547592180-85f173990554')],
  ['Toyuq şorbası (bulyon)', 'Şorbalar', 9, 'Ev toyuq bulyonu, şəhriyə və göyərti ilə.', 'Toyuq bulyonu, şəhriyə, yerkökü, göyərti', IMG('photo-1583608205776-bfd35f0d9f83')],
  // Soyuq qəlyanaltılar
  ['Bruschetta üçlüyü', 'Soyuq qəlyanaltılar', 11, 'Pomidor-reyhan, avokado və göbələkli üç növ bruschetta.', 'Çiabatta, pomidor, avokado, göbələk, reyhan', IMG('photo-1572695157366-5e585ab2b69f')],
  ['Pendir lövhəsi', 'Soyuq qəlyanaltılar', 22, 'Yerli və idxal pendir çeşidləri, bal və qoz-fındıq ilə.', 'Pendir çeşidləri, bal, qoz-fındıq, üzüm', IMG('photo-1452195100486-9cc805987862')],
  ['Hummus və pitə', 'Soyuq qəlyanaltılar', 9, 'Krem hummus, zeytun yağı və isti pitə çörəyi ilə.', 'Noxud, tahin, zeytun yağı, pitə', IMG('photo-1571197119282-7c4e2b0e5ef4')],
  // İsti qəlyanaltılar
  ['Motsarella çubuqları', 'İsti qəlyanaltılar', 12, 'Qızardılmış motsarella, pomidor sousu ilə.', 'Motsarella, çörək qırıntısı, pomidor sousu', IMG('photo-1548340748-6d2b7d7da280')],
  ['Toyuq qanadları (BBQ)', 'İsti qəlyanaltılar', 15, 'BBQ sousunda marinasiya olunmuş qrill toyuq qanadları.', 'Toyuq qanadı, BBQ sousu, susam', IMG('photo-1567620832903-9fc6debc209f')],
  ['Qızardılmış kartof (Chili-cheese)', 'İsti qəlyanaltılar', 10, 'Xırtıldayan kartof fri, əridilmiş pendir və çili sousu ilə.', 'Kartof, pendir, çili sousu', IMG('photo-1573080496219-bb080dd4f877')],
  // Pizzalar
  ['Margarita pizza', 'Pizzalar', 16, 'Pomidor sousu, motsarella və təzə reyhan.', 'Pizza xəmiri, pomidor sousu, motsarella, reyhan', IMG('photo-1574071318508-1cdbab80d002')],
  ['Pepperoni pizza', 'Pizzalar', 19, 'Bol pepperoni və motsarella pendiri ilə klassik pizza.', 'Pizza xəmiri, pepperoni, motsarella, pomidor sousu', IMG('photo-1628840042765-356cda07504e')],
  ['Dörd pendir pizza', 'Pizzalar', 21, 'Motsarella, gorgonzola, parmezan və emmental qarışığı.', 'Pizza xəmiri, motsarella, gorgonzola, parmezan, emmental', IMG('photo-1513104890138-7c749659a591')],
  ['Toyuqlu BBQ pizza', 'Pizzalar', 20, 'Qrill toyuq, qırmızı soğan və BBQ sousu ilə.', 'Pizza xəmiri, toyuq, BBQ sousu, qırmızı soğan, motsarella', IMG('photo-1571066811602-716837d681de')],
  // Pasta (Truffle Pasta artıq var)
  ['Karbonara', 'Pasta', 19, 'Spagetti, bekon, yumurta sarısı və parmezan ilə krem sousu.', 'Spagetti, bekon, yumurta, parmezan, qara istiot', IMG('photo-1612874742237-6526221588e3')],
  ['Boloneze', 'Pasta', 18, 'Ev üsulu mal əti sousu ilə pappardelle pasta.', 'Pappardelle, mal əti qiyməsi, pomidor sousu, sarımsaq', IMG('photo-1621996346565-e3dbc353d2e5')],
  ['Pesto pasta', 'Pasta', 17, 'Reyhan-pesto sousu, çamçürüyü qoz-fındığı və parmezan ilə.', 'Fettuccine, reyhan pesto, parmezan, çamçürüyü qoz-fındığı', IMG('photo-1473093295043-cdd812d0e601')],
  // Burgerlər
  ['Klassik Cheeseburger', 'Burgerlər', 15, 'Mal əti köftəsi, çedar pendiri, marinad xiyar və ev sousu.', 'Mal əti, çedar pendiri, salat, pomidor, marinad xiyar', IMG('photo-1568901346375-23c9450c58cd')],
  ['Double Bacon Burger', 'Burgerlər', 19, 'İki qat mal əti köftəsi, bekon və karamelləşmiş soğan.', 'Mal əti (2 qat), bekon, karamelləşmiş soğan, çedar', IMG('photo-1553979459-d2229ba7433b')],
  ['Toyuqlu Burger', 'Burgerlər', 14, 'Xırtıldayan qızardılmış toyuq filesi, kələm salatı və acı sous.', 'Toyuq filesi, kələm salatı, acı sous', IMG('photo-1571091718767-18b5b1457add')],
  // Qrill və Kabablar
  ['Lüləkabab', 'Qrill və Kabablar', 17, 'Mal ətindən hazırlanmış ənənəvi lüləkabab, göyərti ilə.', 'Mal əti qiyməsi, soğan, ədviyyatlar', IMG('photo-1529193591184-b1d58069ecdd')],
  ['Toyuq şişi', 'Qrill və Kabablar', 16, 'Marinad edilmiş toyuq filesindən şiş kabab.', 'Toyuq filesi, bibər, soğan, ədviyyatlar', IMG('photo-1555939594-58d7cb561ad1')],
  ['Qarışıq qrill', 'Qrill və Kabablar', 28, 'Lüləkabab, toyuq şiş və tikə ətin qarışığı, qrill tərəvəzlə.', 'Mal əti, toyuq, tərəvəz, ədviyyatlar', IMG('photo-1544025162-d76694265947')],
  // Milli yeməklər
  ['Plov (toyuqlu)', 'Milli yeməklər', 18, 'Zəfəranlı düyü, toyuq əti, quru meyvə və şabalıd ilə.', 'Düyü, toyuq, zəfəran, kişmiş, şabalıd', IMG('photo-1596797038530-2c107229654b')],
  ['Dolma', 'Milli yeməklər', 15, 'Üzüm yarpağında mal əti qiyməsi və düyü dolması, qatıq ilə.', 'Üzüm yarpağı, mal əti, düyü, göyərti', IMG('photo-1585032226651-759b368d7246')],
  ['Qutab (ət)', 'Milli yeməklər', 10, 'Nazik xəmirdə mal əti qiyməsi ilə hazırlanmış qutab.', 'Xəmir, mal əti qiyməsi, soğan, sumaq', IMG('photo-1626200419199-391ae4be7a41')],
  // Dəniz məhsulları
  ['Qızardılmış kalamar', 'Dəniz məhsulları', 19, 'Xırtıldayan qızardılmış kalamar halqaları, limon sousu ilə.', 'Kalamar, un, limon', IMG('photo-1599487488170-d11ec9c172f0')],
  ['Qarides qızartması', 'Dəniz məhsulları', 24, 'Sarımsaqlı-kərəli sousda qızardılmış qarides.', 'Qarides, sarımsaq, kərə yağı, limon', IMG('photo-1565680018434-b513d5e5fd47')],
  // Steyklər (Ribeye artıq var)
  ['T-Bone Steak', 'Steyklər', 42, 'Sümüklü mal əti steyki, qrilldə bişirilib.', 'T-bone mal əti, dəniz duzu, qara istiot', IMG('photo-1594041680534-e8c8cdebd659')],
  ['Filet Mignon', 'Steyklər', 45, 'Ən yumşaq mal əti hissəsi, kərə-göbələk sousu ilə.', 'Filet mignon, göbələk, kərə yağı', IMG('photo-1600891964092-4316c288032e')],
  // Səhər yeməkləri
  ['İngilis səhər yeməyi', 'Səhər yeməkləri', 16, 'Yumurta, bekon, sosis, lobya və qızardılmış çörək.', 'Yumurta, bekon, sosis, lobya, çörək', IMG('photo-1533089860892-a7c6f0a88666')],
  ['Omlet (pendirli)', 'Səhər yeməkləri', 9, 'Üç yumurtadan pendirli omlet, göyərti ilə.', 'Yumurta, pendir, göyərti', IMG('photo-1510693206972-df098062cb71')],
  ['Pankeyk', 'Səhər yeməkləri', 11, 'Kağız kimi yumşaq pankeyk, ağcaqayın siropu və giləmeyvə ilə.', 'Un, yumurta, süd, ağcaqayın siropu, giləmeyvə', IMG('photo-1567620905732-2d1ec7ab7445')],
  ['Menemen', 'Səhər yeməkləri', 10, 'Pomidor, bibər və yumurta ilə isti başlanğıc.', 'Yumurta, pomidor, bibər, soğan', IMG('photo-1525351484163-7529414344d8')],
  // Şirniyyatlar (Cheesecake artıq var)
  ['Tiramisu', 'Şirniyyatlar', 11, 'Klassik italyan deserti, mасkarpone kremi və espresso ilə.', 'Savoyardi bisküvi, maskarpone, espresso, kakao', IMG('photo-1571877227200-a0d98ea607e9')],
  ['Şokolad fondan', 'Şirniyyatlar', 12, 'İsti şokolad keyk, içində maye şokolad, vanil dondurma ilə.', 'Şokolad, un, yumurta, kərə yağı, vanil dondurma', IMG('photo-1624353365286-3f8d62daad51')],
  ['Baklava', 'Şirniyyatlar', 9, 'Qoz-fındıqlı, şərbətli ənənəvi baklava.', 'Yufka xəmiri, qoz-fındıq, şərbət', IMG('photo-1519676867240-f03562e64548')],
  ['Panna cotta', 'Şirniyyatlar', 10, 'Vanil panna cotta, giləmeyvə sousu ilə.', 'Krem, süd, vanil, giləmeyvə', IMG('photo-1488477181946-6428a0291777')],
  // Qəhvə və çay
  ['Espresso', 'Qəhvə və çay', 5, 'Klassik İtalyan espresso.', 'Qəhvə çəkirdəyi', IMG('photo-1510707577719-ae7c14805e3a')],
  ['Cappuccino', 'Qəhvə və çay', 7, 'Espresso, süd və köpük ilə klassik cappuccino.', 'Espresso, süd', IMG('photo-1572442388796-11668a67e53d')],
  ['Latte', 'Qəhvə və çay', 7, 'Yumşaq espresso-süd qəhvəsi.', 'Espresso, süd', IMG('photo-1561047029-3000c68339ca')],
  ['Qara çay (samovar)', 'Qəhvə və çay', 4, 'Ənənəvi Azərbaycan qara çayı, limon və şirniyyat ilə.', 'Qara çay yarpağı', IMG('photo-1544787219-7f47ccb76574')],
  // Limonad və kokteyllər
  ['Ev limonadı', 'Limonad və kokteyllər', 7, 'Təzə limon, nanə və soda ilə sərinləşdirici limonad.', 'Limon, nanə, soda, şəkər', IMG('photo-1523677011781-c91d1bbe2f9e')],
  ['Çiyələk-nanə limonadı', 'Limonad və kokteyllər', 8, 'Təzə çiyələk, nanə və limonla hazırlanmış sərinləşdirici içki.', 'Çiyələk, nanə, limon, soda', IMG('photo-1621263764928-df1444c5e859')],
  ['Mojito (alkoqolsuz)', 'Limonad və kokteyllər', 8, 'Nanə, laym və soda ilə klassik alkoqolsuz mojito.', 'Nanə, laym, soda, şəkər', IMG('photo-1551538827-9c037cb4f32a')],
  ['Mango smoothie', 'Limonad və kokteyllər', 9, 'Təzə mango və yoğurtdan hazırlanmış smoothie.', 'Mango, yoğurt, bal', IMG('photo-1546173159-315724a31696')],
];

async function main() {
  const pool = await connect();
  const RID = 1;

  // ---- Restoran brendinqi ----
  const theme = JSON.stringify({
    primary: '#5c1a2e', background: '#f7f0e6', button: '#5c1a2e', font: 'Fraunces',
    hero_image_url: IMG('photo-1517248135467-4c7edcad34c4'),
    hero_title: 'Dadın ən şirin anı',
    hero_subtitle: 'Hər gün təzə hazırlanan yeməklər — masanızdan QR ilə rahat sifariş verin',
    banner_text: 'Xoş gəldiniz! Menyudan seçin, sifarişiniz birbaşa mətbəxə çatsın.',
    footer_text: '© Nar Bistro.',
  });
  await pool.request()
    .input('id', sql.Int, RID)
    .input('name', sql.NVarChar(120), 'Nar Bistro')
    .input('logo', sql.NVarChar(sql.MAX), IMG('photo-1414235077428-338989a2e8c0'))
    .input('address', sql.NVarChar(250), 'Ünvan: Nizami küçəsi 10, Bakı')
    .input('hours', sql.NVarChar(150), 'Hər gün 10:00 – 24:00')
    .input('about', sql.NVarChar(sql.MAX), 'Nar Bistro — Bakının mərkəzində müasir və ənənəvi mətbəxi birləşdirən rəqəmsal menyulu restoran. Təzə məhsullardan hazırlanan yeməklər, rahat QR sifariş sistemi ilə.')
    .input('theme', sql.NVarChar(sql.MAX), theme)
    .input('tableless', sql.Bit, 1)
    .query(`UPDATE restaurants SET name=@name, logo_url=@logo, address=@address, working_hours=@hours, about_text=@about, theme=@theme, allow_tableless_orders=@tableless WHERE id=@id`);
  console.log('[ok] Restoran brendinqi yeniləndi');

  // ---- Kateqoriyalar ----
  const existing = (await pool.request().input('r', sql.Int, RID).query('SELECT id, name FROM categories WHERE restaurant_id=@r')).recordset;
  let sortOrder = existing.length;
  const catIds = {};
  existing.forEach((c) => { catIds[c.name] = c.id; });
  for (const name of NEW_CATEGORIES) {
    if (catIds[name]) continue;
    sortOrder += 1;
    const r = await pool.request()
      .input('r', sql.Int, RID).input('name', sql.NVarChar(60), name).input('slug', sql.NVarChar(60), slugify(name)).input('sort', sql.Int, sortOrder)
      .query('INSERT INTO categories (restaurant_id, name, slug, sort_order) OUTPUT INSERTED.id VALUES (@r, @name, @slug, @sort)');
    catIds[name] = r.recordset[0].id;
  }
  console.log(`[ok] Kateqoriyalar: ${Object.keys(catIds).length} (${NEW_CATEGORIES.length} yeni əlavə edildi/mövcud idi)`);

  // ---- Məhsullar (adı ilə təkrar yoxlanılır — skript təkrar işə düşsə ikiqat yaratmasın) ----
  const existingProducts = new Set((await pool.request().input('r', sql.Int, RID).query('SELECT name FROM products WHERE restaurant_id=@r')).recordset.map((p) => p.name));
  let created = 0;
  for (const [name, catName, price, desc, ingredients, img] of PRODUCTS) {
    if (existingProducts.has(name)) continue;
    const catId = catIds[catName];
    if (!catId) { console.warn(`[xəbərdarlıq] kateqoriya tapılmadı: ${catName} (${name})`); continue; }
    await pool.request()
      .input('r', sql.Int, RID).input('c', sql.Int, catId).input('name', sql.NVarChar(120), name)
      .input('desc', sql.NVarChar(sql.MAX), desc).input('price', sql.Decimal(10, 2), price)
      .input('img', sql.NVarChar(sql.MAX), img).input('ing', sql.NVarChar(sql.MAX), ingredients)
      .query(`INSERT INTO products (restaurant_id, category_id, name, description, price, image_url, ingredients, is_available, is_visible)
              VALUES (@r, @c, @name, @desc, @price, @img, @ing, 1, 1)`);
    created += 1;
  }
  console.log(`[ok] Məhsullar: ${created} yeni yaradıldı`);

  const totals = await pool.request().input('r', sql.Int, RID).query('SELECT (SELECT COUNT(*) FROM categories WHERE restaurant_id=@r) cats, (SELECT COUNT(*) FROM products WHERE restaurant_id=@r) prods');
  console.log(`[yekun] Cəmi kateqoriya: ${totals.recordset[0].cats}, cəmi məhsul: ${totals.recordset[0].prods}`);

  await pool.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
