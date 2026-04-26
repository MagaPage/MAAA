const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const SALT_LENGTH = 16

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32)
}

function encrypt(plaintext, keyString) {
  const salt = crypto.randomBytes(SALT_LENGTH)
  const key = deriveKey(keyString, salt)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext,
  }
}

function decrypt(encrypted, keyString) {
  const salt = encrypted.salt ? Buffer.from(encrypted.salt, 'hex') : Buffer.from('maaa-salt')
  const key = deriveKey(keyString, salt)
  const iv = Buffer.from(encrypted.iv, 'hex')
  const authTag = Buffer.from(encrypted.authTag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8')
  plaintext += decipher.final('utf8')
  return plaintext
}

module.exports = { encrypt, decrypt }
