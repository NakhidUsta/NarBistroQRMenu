const authService = require('../services/authService');
const asyncHandler = require('../utils/asyncHandler');

const COOKIE = 'qrmenu_token';

// Token yalnız imza ilə deyil, DB-də sessiya versiyası və CARİ rol ilə də yoxlanılır (bax: authService.authenticate).
const requireAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) {
    return res.status(401).json({ error: 'Giriş tələb olunur' });
  }
  try {
    req.admin = await authService.authenticate(token);
    next();
  } catch (err) {
    if (err.status === 401) return res.status(401).json({ error: err.message });
    throw err;
  }
});

// authorize('OWNER', 'MANAGER') kimi çağırılır — requireAdmin-dən SONRA istifadə olunmalıdır.
// Rol siyahısı boşdursa yalnız giriş yoxlanılır (hər hansı admin roluna icazə verilir).
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.admin) {
      return res.status(401).json({ error: 'Giriş tələb olunur' });
    }
    if (roles.length && !roles.includes(req.admin.role)) {
      return res.status(403).json({ error: 'Bu əməliyyat üçün icazəniz yoxdur' });
    }
    next();
  };
}

// Cookie varsa req.admin-i doldurur, yoxdursa (və ya etibarsızdırsa) sadəcə davam edir —
// həm admin, həm də açıq (public) istifadəçilərin eyni endpoint-ə müraciət etdiyi yerlərdə istifadə olunur.
const optionalAdmin = asyncHandler(async (req, res, next) => {
  const token = req.cookies?.[COOKIE];
  if (token) {
    try {
      req.admin = await authService.authenticate(token);
    } catch (err) {
      if (err.status !== 401) throw err;
      // etibarsız token — sükutla adi (public) sorğu kimi davam et
    }
  }
  next();
});

module.exports = { requireAdmin, authorize, optionalAdmin };
