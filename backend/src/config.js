const path = require('path');

module.exports = {
  port: parseInt(process.env.PORT || '3000', 10),
  staticDir: path.resolve(process.env.STATIC_DIR || path.join(__dirname, '../../frontend/dist')),
  // Secret salt mixed into the hashed voter identity (set via env / k8s Secret).
  voterSalt: process.env.VOTER_HASH_SALT || '',
  defaultExpiryDays: parseInt(process.env.DEFAULT_EXPIRY_DAYS || '7', 10),
};
