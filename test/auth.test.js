const { describe, it, beforeEach, afterEach } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('fs')
const path = require('path')
const os = require('os')
const { TokenCache } = require('../src/auth/tokenCache')

describe('TokenCache', () => {
  let tmpDir
  let cache

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'maaa-test-'))
    cache = new TokenCache(tmpDir, 'test-key-for-cache')
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('should return null for non-existent user', async () => {
    const result = await cache.load('nonexistent')
    assert.equal(result, null)
  })

  it('should save and load tokens', async () => {
    const tokens = {
      accessToken: 'abc123',
      refreshToken: 'def456',
      expiresAt: Date.now() + 3600000,
    }

    await cache.save('testuser', tokens)
    const loaded = await cache.load('testuser')

    assert.equal(loaded.accessToken, tokens.accessToken)
    assert.equal(loaded.refreshToken, tokens.refreshToken)
    assert.equal(loaded.expiresAt, tokens.expiresAt)
  })

  it('should clear tokens', async () => {
    await cache.save('testuser', { token: 'abc' })
    await cache.clear('testuser')
    const result = await cache.load('testuser')
    assert.equal(result, null)
  })

  it('should handle special characters in username', async () => {
    const tokens = { token: 'test' }
    await cache.save('user@email.com', tokens)
    const loaded = await cache.load('user@email.com')
    assert.equal(loaded.token, 'test')
  })

  it('should return null for corrupted cache file', async () => {
    const filePath = path.join(tmpDir, 'corrupt.enc')
    fs.writeFileSync(filePath, 'not json', { mode: 0o600 })

    const result = await cache.load('corrupt')
    assert.equal(result, null)
  })
})
