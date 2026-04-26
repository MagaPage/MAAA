const https = require('https')
const fs = require('fs')
const path = require('path')
const { URL } = require('url')
const { encrypt, decrypt } = require('../utils/encryption')

const DISCORD_WEBHOOK_PATTERN = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/.+$/
const TELEGRAM_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{20,}$/
const ALLOWED_HOSTS = ['discord.com', 'discordapp.com', 'api.telegram.org']
const MAX_MESSAGE_LENGTH = 2000
const CONFIG_FILE = 'integrations.enc'

class IntegrationManager {
  /**
   * Manage Discord and Telegram notification integrations.
   * Persists config to an encrypted file so credentials survive restarts.
   * @param {object} logger - Winston logger
   * @param {object} [config] - App config (for encryption key and cache dir)
   */
  constructor(logger, config) {
    this.logger = logger
    this.config = config || {}
    this.discord = { enabled: false, webhookUrl: '', channelId: '', notifyCommands: true, notifyErrors: true, notifyTasks: false }
    this.telegram = { enabled: false, botToken: '', chatId: '', notifyCommands: true, notifyErrors: true, notifyTasks: false }
    this._loadPersistedConfig()
  }

  /**
   * Get the path to the persisted integration config file.
   * @returns {string} File path
   */
  _getConfigPath() {
    const dir = this.config.tokenCacheDir || path.join(process.cwd(), 'auth_cache')
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 })
    }
    return path.join(dir, CONFIG_FILE)
  }

  /**
   * Load persisted integration config from encrypted file.
   */
  _loadPersistedConfig() {
    const key = this.config.security?.encryptionKey
    if (!key) return

    const filePath = this._getConfigPath()
    if (!fs.existsSync(filePath)) return

    try {
      const raw = fs.readFileSync(filePath, 'utf8')
      const encrypted = JSON.parse(raw)
      const decrypted = decrypt(encrypted, key)
      const saved = JSON.parse(decrypted)

      if (saved.discord) {
        this.discord = { ...this.discord, ...saved.discord }
        this.logger.info(`Integration config loaded: Discord ${this.discord.enabled ? 'enabled' : 'disabled'}`)
      }
      if (saved.telegram) {
        this.telegram = { ...this.telegram, ...saved.telegram }
        this.logger.info(`Integration config loaded: Telegram ${this.telegram.enabled ? 'enabled' : 'disabled'}`)
      }
    } catch (err) {
      this.logger.warn(`Failed to load integration config: ${err.message}`)
    }
  }

  /**
   * Persist current integration config to encrypted file.
   */
  _persistConfig() {
    const key = this.config.security?.encryptionKey
    if (!key) return

    try {
      const data = JSON.stringify({
        discord: this.discord,
        telegram: this.telegram,
      })
      const encrypted = encrypt(data, key)
      const filePath = this._getConfigPath()
      fs.writeFileSync(filePath, JSON.stringify(encrypted), { mode: 0o600 })
    } catch (err) {
      this.logger.warn(`Failed to persist integration config: ${err.message}`)
    }
  }

  /**
   * Configure Discord webhook integration.
   * @param {object} config - Discord settings
   * @throws {Error} On invalid webhook URL or channel ID format
   */
  configureDiscord(config) {
    if (config.webhookUrl && !DISCORD_WEBHOOK_PATTERN.test(config.webhookUrl)) {
      throw new Error('Invalid Discord webhook URL format')
    }

    if (config.channelId && !/^\d{17,20}$/.test(config.channelId)) {
      throw new Error('Invalid Discord channel ID format')
    }

    this.discord = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : this.discord.enabled,
      webhookUrl: typeof config.webhookUrl === 'string' ? config.webhookUrl : this.discord.webhookUrl,
      channelId: typeof config.channelId === 'string' ? config.channelId : this.discord.channelId,
      notifyCommands: typeof config.notifyCommands === 'boolean' ? config.notifyCommands : this.discord.notifyCommands,
      notifyErrors: typeof config.notifyErrors === 'boolean' ? config.notifyErrors : this.discord.notifyErrors,
      notifyTasks: typeof config.notifyTasks === 'boolean' ? config.notifyTasks : this.discord.notifyTasks,
    }
    this.logger.info(`Discord integration ${this.discord.enabled ? 'enabled' : 'disabled'}`)
    this._persistConfig()
  }

  /**
   * Configure Telegram bot integration.
   * @param {object} config - Telegram settings
   * @throws {Error} On invalid bot token or chat ID format
   */
  configureTelegram(config) {
    if (config.botToken && !TELEGRAM_TOKEN_PATTERN.test(config.botToken)) {
      throw new Error('Invalid Telegram bot token format')
    }

    if (config.chatId && !/^-?\d{1,20}$/.test(config.chatId)) {
      throw new Error('Invalid Telegram chat ID format')
    }

    this.telegram = {
      enabled: typeof config.enabled === 'boolean' ? config.enabled : this.telegram.enabled,
      botToken: typeof config.botToken === 'string' ? config.botToken : this.telegram.botToken,
      chatId: typeof config.chatId === 'string' ? config.chatId : this.telegram.chatId,
      notifyCommands: typeof config.notifyCommands === 'boolean' ? config.notifyCommands : this.telegram.notifyCommands,
      notifyErrors: typeof config.notifyErrors === 'boolean' ? config.notifyErrors : this.telegram.notifyErrors,
      notifyTasks: typeof config.notifyTasks === 'boolean' ? config.notifyTasks : this.telegram.notifyTasks,
    }
    this.logger.info(`Telegram integration ${this.telegram.enabled ? 'enabled' : 'disabled'}`)
    this._persistConfig()
  }

  /**
   * Send a message via Discord webhook.
   * @param {string} [content] - Text content
   * @param {Array} [embeds] - Discord embed objects
   * @returns {Promise<object>} Response
   */
  async sendDiscordWebhook(content, embeds) {
    if (!this.discord.enabled || !this.discord.webhookUrl) return

    const safeContent = content ? sanitizeText(content) : undefined
    const payload = JSON.stringify({ content: safeContent, embeds })
    return this._httpsPost(this.discord.webhookUrl, payload, { 'Content-Type': 'application/json' })
  }

  /**
   * Send a test message to a Discord webhook.
   * @param {string} webhookUrl - Webhook URL to test
   * @returns {Promise<object>} Response
   * @throws {Error} On invalid URL format
   */
  async testDiscordWebhook(webhookUrl) {
    if (!DISCORD_WEBHOOK_PATTERN.test(webhookUrl)) {
      throw new Error('Invalid Discord webhook URL format')
    }

    const payload = JSON.stringify({
      embeds: [{
        title: 'MAAA Test Message',
        description: 'Discord webhook is working! Your Minecraft bot will send notifications here.',
        color: 0x7c9aff,
        timestamp: new Date().toISOString(),
        footer: { text: 'Minecraft AI Architect & Automator' },
      }],
    })

    return this._httpsPost(webhookUrl, payload, { 'Content-Type': 'application/json' })
  }

  /**
   * Send a message via Telegram Bot API.
   * @param {string} text - Message text (HTML)
   * @returns {Promise<object>} Response
   */
  async sendTelegramMessage(text) {
    if (!this.telegram.enabled || !this.telegram.botToken || !this.telegram.chatId) return

    if (!TELEGRAM_TOKEN_PATTERN.test(this.telegram.botToken)) return

    const url = `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`
    const safeText = sanitizeText(text)
    const payload = JSON.stringify({
      chat_id: this.telegram.chatId,
      text: safeText,
      parse_mode: 'HTML',
    })

    return this._httpsPost(url, payload, { 'Content-Type': 'application/json' })
  }

  /**
   * Send a test message via Telegram Bot API.
   * @param {string} botToken - Telegram bot token
   * @param {string} chatId - Telegram chat ID
   * @returns {Promise<object>} Response
   * @throws {Error} On invalid token or chat ID format
   */
  async testTelegram(botToken, chatId) {
    if (!TELEGRAM_TOKEN_PATTERN.test(botToken)) {
      throw new Error('Invalid Telegram bot token format')
    }

    if (!/^-?\d{1,20}$/.test(chatId)) {
      throw new Error('Invalid Telegram chat ID format')
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const payload = JSON.stringify({
      chat_id: chatId,
      text: '<b>MAAA Test Message</b>\n\nTelegram integration is working! Your Minecraft bot will send notifications here.',
      parse_mode: 'HTML',
    })

    return this._httpsPost(url, payload, { 'Content-Type': 'application/json' })
  }

  /**
   * Notify integrations that a command was executed.
   * @param {string} userMessage - The user's input
   * @param {string} action - The parsed action type
   */
  notifyCommand(userMessage, action) {
    const safeMessage = sanitizeText(userMessage)
    const safeAction = sanitizeText(action)

    if (this.discord.notifyCommands) {
      this.sendDiscordWebhook(null, [{
        title: 'Command Executed',
        description: `**Input:** ${safeMessage}\n**Action:** ${safeAction}`,
        color: 0x7c9aff,
        timestamp: new Date().toISOString(),
      }]).catch(() => {})
    }

    if (this.telegram.notifyCommands) {
      this.sendTelegramMessage(
        `<b>Command Executed</b>\n<b>Input:</b> ${escapeHtml(userMessage)}\n<b>Action:</b> ${escapeHtml(action)}`
      ).catch(() => {})
    }
  }

  /**
   * Notify integrations of an error.
   * @param {string} error - Error message
   */
  notifyError(error) {
    const safeError = sanitizeText(error)

    if (this.discord.notifyErrors) {
      this.sendDiscordWebhook(null, [{
        title: 'Error',
        description: safeError,
        color: 0xf44336,
        timestamp: new Date().toISOString(),
      }]).catch(() => {})
    }

    if (this.telegram.notifyErrors) {
      this.sendTelegramMessage(`<b>Error</b>\n${escapeHtml(error)}`).catch(() => {})
    }
  }

  /**
   * Notify integrations that a task completed.
   * @param {string} action - The action that completed
   * @param {number} duration - Duration in milliseconds
   */
  notifyTaskComplete(action, duration) {
    const safeAction = sanitizeText(action)
    const safeDuration = parseInt(duration, 10) || 0

    if (this.discord.notifyTasks) {
      this.sendDiscordWebhook(null, [{
        title: 'Task Complete',
        description: `**Action:** ${safeAction}\n**Duration:** ${safeDuration}ms`,
        color: 0x4caf50,
        timestamp: new Date().toISOString(),
      }]).catch(() => {})
    }

    if (this.telegram.notifyTasks) {
      this.sendTelegramMessage(
        `<b>Task Complete</b>\n<b>Action:</b> ${escapeHtml(action)}\n<b>Duration:</b> ${safeDuration}ms`
      ).catch(() => {})
    }
  }

  /**
   * Get current integration status (safe for API responses — no secrets).
   * @returns {object} Status of Discord and Telegram integrations
   */
  getStatus() {
    return {
      discord: {
        enabled: this.discord.enabled,
        configured: !!this.discord.webhookUrl,
        notifyCommands: this.discord.notifyCommands,
        notifyErrors: this.discord.notifyErrors,
        notifyTasks: this.discord.notifyTasks,
      },
      telegram: {
        enabled: this.telegram.enabled,
        configured: !!this.telegram.botToken && !!this.telegram.chatId,
        notifyCommands: this.telegram.notifyCommands,
        notifyErrors: this.telegram.notifyErrors,
        notifyTasks: this.telegram.notifyTasks,
      },
    }
  }

  /**
   * Make an HTTPS POST request with SSRF protection.
   * Only allows requests to ALLOWED_HOSTS over HTTPS.
   * @param {string} urlStr - Target URL
   * @param {string} body - Request body
   * @param {object} headers - Request headers
   * @returns {Promise<object>} Response with status and body
   */
  _httpsPost(urlStr, body, headers) {
    return new Promise((resolve, reject) => {
      let parsed
      try {
        parsed = new URL(urlStr)
      } catch {
        return reject(new Error('Invalid URL'))
      }

      if (parsed.protocol !== 'https:') {
        return reject(new Error('Only HTTPS URLs are allowed'))
      }

      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        return reject(new Error('URL host not allowed'))
      }

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
        timeout: 10000,
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
          if (data.length > 100000) {
            req.destroy(new Error('Response too large'))
          }
        })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: data })
          } else {
            reject(new Error(`Request failed with status ${res.statusCode}`))
          }
        })
      })

      req.on('timeout', () => {
        req.destroy(new Error('Request timed out'))
      })

      req.on('error', (err) => reject(new Error(err.message || 'Request failed')))
      req.write(body)
      req.end()
    })
  }
}

/**
 * Strip HTML-like characters from text.
 * @param {string} text - Input text
 * @returns {string} Sanitized text
 */
function sanitizeText(text) {
  if (typeof text !== 'string') return ''
  return text.slice(0, MAX_MESSAGE_LENGTH).replace(/[<>]/g, '')
}

/**
 * Escape HTML entities in text for Telegram HTML mode.
 * @param {string} text - Input text
 * @returns {string} HTML-escaped text
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return ''
  return text.slice(0, MAX_MESSAGE_LENGTH)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

module.exports = { IntegrationManager }
