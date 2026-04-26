const fs = require('fs')
const path = require('path')
const { encrypt, decrypt } = require('../utils/encryption')

class TokenCache {
  constructor(cacheDir, encryptionKey) {
    this.cacheDir = cacheDir
    this.encryptionKey = encryptionKey
    this._ensureCacheDir()
  }

  _ensureCacheDir() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true, mode: 0o700 })
    }
  }

  _getFilePath(username) {
    const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.cacheDir, `${sanitized}.enc`)
  }

  async load(username) {
    const filePath = this._getFilePath(username)
    if (!fs.existsSync(filePath)) return null

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const encrypted = JSON.parse(raw)
      const decrypted = decrypt(encrypted, this.encryptionKey)
      return JSON.parse(decrypted)
    } catch {
      return null
    }
  }

  async save(username, tokens) {
    const filePath = this._getFilePath(username)
    const plaintext = JSON.stringify(tokens)
    const encrypted = encrypt(plaintext, this.encryptionKey)
    fs.writeFileSync(filePath, JSON.stringify(encrypted), { mode: 0o600 })
  }

  async clear(username) {
    const filePath = this._getFilePath(username)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}

module.exports = { TokenCache }
