const jwt = require('jsonwebtoken');

// Hər rola sabit ID: adminUserRepository.findAuthState mock-u ID-yə görə cari rolu qaytarır.
const ROLE_IDS = { OWNER: 1, MANAGER: 2, WAITER: 3, KITCHEN: 4 };
const ID_ROLES = Object.fromEntries(Object.entries(ROLE_IDS).map(([role, id]) => [id, role]));

function cookieFor(role, { tv = 0, id = ROLE_IDS[role] } = {}) {
  const token = jwt.sign({ id, email: `${role.toLowerCase()}@test.local`, role, restaurant_id: 1, tv }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return [`qrmenu_token=${token}`];
}

function authStateFor(id) {
  const role = ID_ROLES[id];
  return role ? { id, email: `${role.toLowerCase()}@test.local`, role, restaurant_id: 1, token_version: 0 } : null;
}

// Verilənlər bazasına qoşulmadan: mssql tipləri həqiqidir, pool isə saxtadır.
const fakePool = {
  request: () => {
    const req = { input: () => req, query: async () => ({ recordset: [{ ok: 1 }], rowsAffected: [1] }) };
    return req;
  },
};

module.exports = { cookieFor, authStateFor, fakePool, ROLE_IDS };
