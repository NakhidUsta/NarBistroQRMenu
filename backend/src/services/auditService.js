const auditRepository = require('../repositories/auditRepository');

const SENSITIVE_KEYS = ['password', 'password_hash', 'access_token'];

function sanitize(value) {
  if (value == null) return null;
  const copy = { ...value };
  SENSITIVE_KEYS.forEach((k) => delete copy[k]);
  return JSON.stringify(copy);
}

// Audit yazısı heç vaxt əsas əməliyyatı sındırmamalıdır — xəta olarsa yalnız log-a yazılır.
async function log(req, action, entityType, entityId, before, after) {
  try {
    await auditRepository.insert({
      admin_user_id: req.admin?.id,
      action,
      entity_type: entityType,
      entity_id: entityId,
      before_json: sanitize(before),
      after_json: sanitize(after),
      ip_address: req.ip,
    });
  } catch (err) {
    console.error('Audit log yazıla bilmədi:', err.message);
  }
}

async function list(filters) {
  return auditRepository.findRecent(filters);
}

module.exports = { log, list };
