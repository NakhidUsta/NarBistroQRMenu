const paymentsConfig = require('../../config/payments');
const epoint = require('./epoint');
const testProvider = require('./testProvider');

const PROVIDERS = { epoint, test: testProvider };

// Aktiv onlayn ödəniş provayderi (yoxdursa və ya açarlar yoxdursa null → onlayn ödəniş müştəriyə göstərilmir)
function getProvider() {
  const provider = PROVIDERS[paymentsConfig.get().provider];
  return provider && provider.isConfigured() ? provider : null;
}

const isOnlineAvailable = () => !!getProvider();

module.exports = { getProvider, isOnlineAvailable, PROVIDERS };
