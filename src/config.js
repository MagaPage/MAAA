const dotenv = require('dotenv')
const path = require('path')
const crypto = require('crypto')

dotenv.config()

function loadConfig() {
  const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(16).toString('hex')

  return {
    mc: {
      host: process.env.MC_HOST || 'localhost',
      port: parseInt(process.env.MC_PORT, 10) || 25565,
      version: process.env.MC_VERSION || '1.20.4',
      auth: process.env.MC_AUTH || 'microsoft',
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
    },
    web: {
      port: parseInt(process.env.WEB_PORT, 10) || 3001,
    },
    security: {
      encryptionKey,
      leashMaxDistance: parseInt(process.env.LEASH_MAX_DISTANCE, 10) || 256,
      leashEnabled: process.env.LEASH_ENABLED !== 'false',
    },
    tokenCacheDir: process.env.TOKEN_CACHE_DIR || path.join(process.cwd(), 'auth_cache'),
    logLevel: process.env.LOG_LEVEL || 'info',
  }
}

module.exports = { loadConfig }
