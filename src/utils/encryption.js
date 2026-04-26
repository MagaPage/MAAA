const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
// Auth tag length is controlled by the GCM cipher (16 bytes default)

function deriveKey(password) {
  return crypto.scryptSync(password, 'maaa-salt', 32)
}

function encrypt(plaintext, keyString) {
  const key = deriveKey(keyString)
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex')
  ciphertext += cipher.final('hex')
  const authTag = cipher.getAuthTag()

  return {
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext,
  }
}

function decrypt(encrypted, keyString) {
  const key = deriveKey(keyString)
  const iv = Buffer.from(encrypted.iv, 'hex')
  const authTag = Buffer.from(encrypted.authTag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8')
  plaintext += decipher.final('utf8')
  return plaintext
}

module.exports = { encrypt, decrypt }
