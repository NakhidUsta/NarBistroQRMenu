const AppError = require('./AppError');

// Kursor (keyset) səhifələmə: `limit` (1..maxLimit) və `before` (bu ID-dən KİÇİK qeydlər). OFFSET istifadə olunmur —
// siyahı canlı dəyişəndə (yeni sifariş gələndə) qeydlər təkrarlanmır/itmir.
// Cavab gövdəsi əvvəlki kimi massivdir (geriyə uyğunluq); qalan qeyd olub-olmadığı `X-Has-More` başlığındadır.
function parsePage(query, { defaultLimit = 200, maxLimit = 200 } = {}) {
  const limit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > maxLimit) {
    throw new AppError(400, `limit 1-${maxLimit} arasında tam ədəd olmalıdır`);
  }
  let before;
  if (query.before !== undefined) {
    before = Number(query.before);
    if (!Number.isInteger(before) || before <= 0) throw new AppError(400, 'before müsbət tam ədəd olmalıdır');
  }
  return { limit, before };
}

// Repozitoriyadan `limit + 1` sətir istənilir; artıq sətir "daha var" deməkdir və qaytarılmır.
function sendPage(res, rows, limit) {
  const hasMore = rows.length > limit;
  res.set('X-Has-More', hasMore ? '1' : '0');
  return hasMore ? rows.slice(0, limit) : rows;
}

module.exports = { parsePage, sendPage };
