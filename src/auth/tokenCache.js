const fs = require('fs')
const path = require('path')
const { encrypt, decrypt } = require('../utils/encryption')

class TokenCache {
  /**
   * Encrypted file-based token cache using AES-256-GCM.
   * @param {string} cacheDir - Directory for cached token files
   * @param {string} encryptionKey - Encryption key for AES-256-GCM
   */
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

  /**
   * Get the file path for a username's token cache.
   * @param {string} username - Username (sanitized for filesystem)
   * @returns {string} Absolute path to cache file
   */
  _getFilePath(username) {
    const sanitized = username.replace(/[^a-zA-Z0-9_-]/g, '_')
    return path.join(this.cacheDir, `${sanitized}.enc`)
  }

  /**
   * Load and decrypt a cached token.
   * @param {string} username - Username to load
   * @returns {Promise<object|null>} Decrypted token data or null
   */
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

  /**
   * Encrypt and save token data to file.
   * @param {string} username - Username to save under
   * @param {object} tokens - Token data to encrypt
   * @returns {Promise<void>}
   */
  async save(username, tokens) {
    const filePath = this._getFilePath(username)
    const plaintext = JSON.stringify(tokens)
    const encrypted = encrypt(plaintext, this.encryptionKey)
    fs.writeFileSync(filePath, JSON.stringify(encrypted), { mode: 0o600 })
  }

  /**
   * Delete a cached token file.
   * @param {string} username - Username to clear
   * @returns {Promise<void>}
   */
  async clear(username) {
    const filePath = this._getFilePath(username)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
  }
}

module.exports = { TokenCache }
