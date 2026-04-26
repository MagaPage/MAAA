const { describe, it } = require('node:test')
const assert = require('node:assert/strict')
const { encrypt, decrypt } = require('../src/utils/encryption')

describe('encryption', () => {
  const key = 'test-encryption-key-32chars!!!!!'

  it('should encrypt and decrypt a string', () => {
    const plaintext = 'Hello, Minecraft!'
    const encrypted = encrypt(plaintext, key)

    assert.ok(encrypted.iv)
    assert.ok(encrypted.authTag)
    assert.ok(encrypted.ciphertext)

    const decrypted = decrypt(encrypted, key)
    assert.equal(decrypted, plaintext)
  })

  it('should encrypt and decrypt JSON tokens', () => {
    const tokens = {
      accessToken: 'abc123',
      refreshToken: 'def456',
      expiresAt: Date.now() + 3600000,
    }

    const plaintext = JSON.stringify(tokens)
    const encrypted = encrypt(plaintext, key)
    const decrypted = decrypt(encrypted, key)
    const parsed = JSON.parse(decrypted)

    assert.equal(parsed.accessToken, tokens.accessToken)
    assert.equal(parsed.refreshToken, tokens.refreshToken)
    assert.equal(parsed.expiresAt, tokens.expiresAt)
  })

  it('should produce different ciphertext for same input (random IV)', () => {
    const plaintext = 'same input'
    const encrypted1 = encrypt(plaintext, key)
    const encrypted2 = encrypt(plaintext, key)

    assert.notEqual(encrypted1.iv, encrypted2.iv)
    assert.notEqual(encrypted1.ciphertext, encrypted2.ciphertext)
  })

  it('should fail to decrypt with wrong key', () => {
    const plaintext = 'secret data'
    const encrypted = encrypt(plaintext, key)

    assert.throws(() => {
      decrypt(encrypted, 'wrong-key-that-is-also-32chars!!')
    })
  })

  it('should fail to decrypt tampered ciphertext', () => {
    const plaintext = 'secret data'
    const encrypted = encrypt(plaintext, key)
    encrypted.ciphertext = 'tampered' + encrypted.ciphertext

    assert.throws(() => {
      decrypt(encrypted, key)
    })
  })
})
