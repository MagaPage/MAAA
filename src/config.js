const dotenv = require('dotenv')
const path = require('path')
const crypto = require('crypto')

dotenv.config()

/**
 * Load and return application configuration from environment variables.
 * @returns {object} Configuration object with all settings
 */
function loadConfig() {
  const encryptionKey = process.env.ENCRYPTION_KEY || crypto.randomBytes(16).toString('hex')

  return {
    mc: {
      host: process.env.MC_HOST || 'localhost',
      port: parseInt(process.env.MC_PORT, 10) || 25565,
      version: process.env.MC_VERSION || '1.20.4',
      auth: process.env.MC_AUTH || 'microsoft',
      reconnect: process.env.MC_RECONNECT !== 'false',
      reconnectDelay: parseInt(process.env.MC_RECONNECT_DELAY, 10) || 5000,
      reconnectMaxRetries: parseInt(process.env.MC_RECONNECT_MAX_RETRIES, 10) || 10,
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || '',
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      maxContextTokens: parseInt(process.env.OPENAI_MAX_CONTEXT_TOKENS, 10) || 8000,
    },
    web: {
      port: parseInt(process.env.WEB_PORT, 10) || 3001,
      dashboardPassword: process.env.DASHBOARD_PASSWORD || '',
      bindLocalhost: process.env.BIND_LOCALHOST === 'true',
      httpsKey: process.env.HTTPS_KEY || '',
      httpsCert: process.env.HTTPS_CERT || '',
    },
    security: {
      encryptionKey,
      leashMaxDistance: parseInt(process.env.LEASH_MAX_DISTANCE, 10) || 256,
      leashEnabled: process.env.LEASH_ENABLED !== 'false',
    },
    tokenCacheDir: process.env.TOKEN_CACHE_DIR || path.join(process.cwd(), 'auth_cache'),
    logLevel: process.env.LOG_LEVEL || 'info',
    logFile: process.env.LOG_FILE || '',
  }
}

module.exports = { loadConfig }
