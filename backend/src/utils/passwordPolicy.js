const AppError = require('./AppError');

const MIN_LENGTH = 8;
// bcrypt yalnız ilk 72 baytı nəzərə alır: daha uzun şifrə "təhlükəsiz" görünür, amma sonrası heç nəyə təsir etmir və nəhəng giriş CPU-nu yükləyir
const MAX_LENGTH = 128;

// Şifrə mətn olmalıdır (rəqəm/massiv/obyekt bcrypt-də 500 verirdi) və 8–128 simvol arasında
function assertPasswordAcceptable(password, label = 'Şifrə') {
  if (typeof password !== 'string' || password.length < MIN_LENGTH) throw new AppError(400, `${label} ən azı ${MIN_LENGTH} simvol olmalıdır`);
  if (password.length > MAX_LENGTH) throw new AppError(400, `${label} ən çox ${MAX_LENGTH} simvol ola bilər`);
}

module.exports = { assertPasswordAcceptable, MIN_LENGTH, MAX_LENGTH };
