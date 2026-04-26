const https = require('https')
const { URL } = require('url')

class IntegrationManager {
  constructor(logger) {
    this.logger = logger
    this.discord = { enabled: false, webhookUrl: '', channelId: '', notifyCommands: true, notifyErrors: true, notifyTasks: false }
    this.telegram = { enabled: false, botToken: '', chatId: '', notifyCommands: true, notifyErrors: true, notifyTasks: false }
  }

  configureDiscord(config) {
    this.discord = { ...this.discord, ...config }
    this.logger.info(`Discord integration ${this.discord.enabled ? 'enabled' : 'disabled'}`)
  }

  configureTelegram(config) {
    this.telegram = { ...this.telegram, ...config }
    this.logger.info(`Telegram integration ${this.telegram.enabled ? 'enabled' : 'disabled'}`)
  }

  async sendDiscordWebhook(content, embeds) {
    if (!this.discord.enabled || !this.discord.webhookUrl) return

    const payload = JSON.stringify({ content, embeds })
    return this._httpsPost(this.discord.webhookUrl, payload, { 'Content-Type': 'application/json' })
  }

  async testDiscordWebhook(webhookUrl) {
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

  async sendTelegramMessage(text) {
    if (!this.telegram.enabled || !this.telegram.botToken || !this.telegram.chatId) return

    const url = `https://api.telegram.org/bot${this.telegram.botToken}/sendMessage`
    const payload = JSON.stringify({
      chat_id: this.telegram.chatId,
      text,
      parse_mode: 'HTML',
    })

    return this._httpsPost(url, payload, { 'Content-Type': 'application/json' })
  }

  async testTelegram(botToken, chatId) {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`
    const payload = JSON.stringify({
      chat_id: chatId,
      text: '<b>MAAA Test Message</b>\n\nTelegram integration is working! Your Minecraft bot will send notifications here.',
      parse_mode: 'HTML',
    })

    return this._httpsPost(url, payload, { 'Content-Type': 'application/json' })
  }

  notifyCommand(userMessage, action) {
    if (this.discord.notifyCommands) {
      this.sendDiscordWebhook(null, [{
        title: 'Command Executed',
        description: `**Input:** ${userMessage}\n**Action:** ${action}`,
        color: 0x7c9aff,
        timestamp: new Date().toISOString(),
      }]).catch(() => {})
    }

    if (this.telegram.notifyCommands) {
      this.sendTelegramMessage(
        `<b>Command Executed</b>\n<b>Input:</b> ${userMessage}\n<b>Action:</b> ${action}`
      ).catch(() => {})
    }
  }

  notifyError(error) {
    if (this.discord.notifyErrors) {
      this.sendDiscordWebhook(null, [{
        title: 'Error',
        description: error,
        color: 0xf44336,
        timestamp: new Date().toISOString(),
      }]).catch(() => {})
    }

    if (this.telegram.notifyErrors) {
      this.sendTelegramMessage(`<b>Error</b>\n${error}`).catch(() => {})
    }
  }

  notifyTaskComplete(action, duration) {
    if (this.discord.notifyTasks) {
      this.sendDiscordWebhook(null, [{
        title: 'Task Complete',
        description: `**Action:** ${action}\n**Duration:** ${duration}ms`,
        color: 0x4caf50,
        timestamp: new Date().toISOString(),
      }]).catch(() => {})
    }

    if (this.telegram.notifyTasks) {
      this.sendTelegramMessage(
        `<b>Task Complete</b>\n<b>Action:</b> ${action}\n<b>Duration:</b> ${duration}ms`
      ).catch(() => {})
    }
  }

  _httpsPost(urlStr, body, headers) {
    return new Promise((resolve, reject) => {
      const parsed = new URL(urlStr)
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || 443,
        path: parsed.pathname + parsed.search,
        method: 'POST',
        headers: { ...headers, 'Content-Length': Buffer.byteLength(body) },
      }

      const req = https.request(options, (res) => {
        let data = ''
        res.on('data', (chunk) => { data += chunk })
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ status: res.statusCode, body: data })
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`))
          }
        })
      })

      req.on('error', reject)
      req.write(body)
      req.end()
    })
  }
}

module.exports = { IntegrationManager }
