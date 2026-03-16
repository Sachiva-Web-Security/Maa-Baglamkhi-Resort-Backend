const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

async function hashPassword(plainPassword) {
  if (!plainPassword) throw new Error('Password is required for hashing');
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
}

async function comparePassword(plainPassword, hash) {
  if (!plainPassword || !hash) return false;
  return bcrypt.compare(plainPassword, hash);
}

module.exports = {
  hashPassword,
  comparePassword
};

