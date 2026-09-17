const jwt = require('jsonwebtoken');

function requireAdmin(req, res, next) {
  const token = req.cookies?.qrmenu_token;
  if (!token) {
    return res.status(401).json({ error: 'Giriş tələb olunur' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: 'Sessiya etibarsızdır, yenidən daxil olun' });
  }
}

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
function optionalAdmin(req, res, next) {
  const token = req.cookies?.qrmenu_token;
  if (!token) return next();
  try {
    req.admin = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    // etibarsız token — sükutla adi (public) sorğu kimi davam et
  }
  next();
}

module.exports = { requireAdmin, authorize, optionalAdmin };
