const jwt = require('jsonwebtoken');

function cookieFor(role, id = 1) {
  const token = jwt.sign({ id, email: `${role.toLowerCase()}@test.local`, role, restaurant_id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return [`qrmenu_token=${token}`];
}

// Verilənlər bazasına qoşulmadan: mssql tipləri həqiqidir, pool isə saxtadır.
const fakePool = {
  request: () => {
    const req = { input: () => req, query: async () => ({ recordset: [{ ok: 1 }], rowsAffected: [1] }) };
    return req;
  },
};

module.exports = { cookieFor, fakePool };
