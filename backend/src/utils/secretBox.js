const crypto = require('crypto');

// Kiçik sirr şifrələyicisi (AES-256-GCM): bazada saxlanılan məxfi dəyərlər (məs. Gmail App Password) açıq mətn olmasın.
// Açar JWT_SECRET-dən törəyir; JWT_SECRET dəyişərsə köhnə dəyərlər açılmır (decrypt xəta atır) — istifadəçi yenidən daxil edir.
const key = () => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET təyin edilməyib');
  return crypto.createHash('sha256').update(`secret-box:${process.env.JWT_SECRET}`).digest();
};

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${enc.toString('hex')}`;
}

function decrypt(payload) {
  const [version, iv, tag, data] = String(payload).split(':');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Şifrələnmiş dəyər formatı yanlışdır');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'hex')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
