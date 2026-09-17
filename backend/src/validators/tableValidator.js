function validateTableBody(body) {
  const { label } = body;
  if (!label || !String(label).trim()) return 'Masa adı tələb olunur';
  if (body.capacity !== undefined && (!Number.isInteger(Number(body.capacity)) || Number(body.capacity) <= 0)) {
    return 'Tutum (capacity) müsbət tam ədəd olmalıdır';
  }
  return null;
}

function validateId(id) {
  return Number.isInteger(id) && id > 0;
}

module.exports = { validateTableBody, validateId };
