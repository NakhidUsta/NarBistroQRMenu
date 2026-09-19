const allergenRepository = require('../repositories/allergenRepository');

async function list() {
  return allergenRepository.findAll();
}

async function existingIds() {
  return new Set((await allergenRepository.findAll()).map((a) => a.id));
}

module.exports = { list, existingIds };
