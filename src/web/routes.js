const express = require('express')

const MAX_COMMAND_LENGTH = 500
const MAX_WEBHOOK_URL_LENGTH = 200
const MAX_TOKEN_LENGTH = 100

/**
 * Create all API routes for the MAAA dashboard.
 * @param {object} botManager - BotManager instance
 * @param {object} skillController - SkillController instance
 * @param {object} llmInterface - LLMInterface instance
 * @param {object} contextGenerator - ContextGenerator instance
 * @param {object} leash - Leash instance
 * @param {object} integrationManager - IntegrationManager instance
 * @returns {express.Router} Configured router
 */
function createRoutes(botManager, skillController, llmInterface, contextGenerator, leash, integrationManager) {
  const router = express.Router()

  router.get('/health', (_req, res) => {
    const botConnected = !!botManager.bot
    res.json({
      status: 'ok',
      uptime: Math.floor(process.uptime()),
      bot: botConnected ? 'connected' : 'disconnected',
      memory: Math.floor(process.memoryUsage().heapUsed / 1024 / 1024),
    })
  })

  router.get('/integrations/status', (_req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }
    res.json(integrationManager.getStatus())
  })

  router.post('/schematic', async (req, res) => {
    try {
      const { schematic } = req.body
      if (!schematic || typeof schematic !== 'object') {
        return res.status(400).json({ error: 'Schematic data is required' })
      }

      if (!botManager.bot) {
        return res.status(503).json({ error: 'Bot is not connected' })
      }

      const command = {
        success: true,
        action: 'build',
        params: { schematic, type: 'schematic' },
      }

      const result = await skillController.execute(command)
      res.json({ success: true, result })
    } catch (err) {
      res.status(500).json({ error: 'Failed to build schematic' })
    }
  })

  router.post('/command', async (req, res) => {
    try {
      const { message } = req.body
      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' })
      }

      const trimmed = message.trim().slice(0, MAX_COMMAND_LENGTH)
      if (!trimmed) {
        return res.status(400).json({ error: 'Message cannot be empty' })
      }

      const context = contextGenerator.generate()
      const command = await llmInterface.processWithHistory(trimmed, context)

      if (!command.success) {
        return res.status(400).json({
          error: 'Failed to parse command',
          details: typeof command.error === 'string' ? command.error.slice(0, 200) : 'Unknown error',
        })
      }

      const result = await skillController.execute(command)

      if (integrationManager) {
        integrationManager.notifyCommand(trimmed, command.action)
      }

      res.json({ command: { action: command.action, success: command.success }, result })
    } catch (err) {
      if (integrationManager) {
        integrationManager.notifyError(err.message)
      }
      res.status(500).json({ error: 'Command execution failed' })
    }
  })

  router.get('/status', (_req, res) => {
    const state = botManager.getState()
    if (!state) {
      return res.status(503).json({ error: 'Bot not connected' })
    }

    res.json({
      ...state,
      leash: {
        enabled: leash.enabled,
        maxDistance: leash.maxDistance,
        origin: leash.origin,
        currentDistance: leash.origin
          ? Math.floor(leash.getDistance(botManager.bot?.entity?.position || leash.origin))
          : 0,
      },
      currentTask: skillController.getCurrentTask(),
    })
  })

  router.get('/history', (_req, res) => {
    res.json(skillController.getHistory())
  })

  router.post('/connect', async (req, res) => {
    try {
      if (botManager.bot) {
        return res.status(400).json({ error: 'Bot already connected' })
      }
      res.json({ message: 'Connection initiated. Check /api/status for updates.' })
    } catch {
      res.status(500).json({ error: 'Connection failed' })
    }
  })

  router.post('/disconnect', async (_req, res) => {
    try {
      await botManager.disconnect()
      res.json({ message: 'Bot disconnected' })
    } catch {
      res.status(500).json({ error: 'Disconnect failed' })
    }
  })

  router.post('/leash', (req, res) => {
    const { maxDistance, enabled, override } = req.body

    if (maxDistance !== undefined) {
      const dist = parseInt(maxDistance, 10)
      if (isNaN(dist) || dist < 1 || dist > 10000) {
        return res.status(400).json({ error: 'maxDistance must be between 1 and 10000' })
      }
      leash.maxDistance = dist
    }

    if (enabled === true) {
      leash.enable()
    } else if (enabled === false) {
      leash.disable()
    }

    if (override === true && botManager.bot?.entity) {
      leash.setOrigin(botManager.bot.entity.position)
    }

    res.json({
      enabled: leash.enabled,
      maxDistance: leash.maxDistance,
      origin: leash.origin,
    })
  })

  // Integration routes
  router.post('/integrations/discord', (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      const { webhookUrl, channelId, notifyCommands, notifyErrors, notifyTasks, enabled } = req.body

      if (webhookUrl && (typeof webhookUrl !== 'string' || webhookUrl.length > MAX_WEBHOOK_URL_LENGTH)) {
        return res.status(400).json({ error: 'Invalid webhook URL' })
      }

      integrationManager.configureDiscord({
        webhookUrl,
        channelId: typeof channelId === 'string' ? channelId.slice(0, 20) : undefined,
        notifyCommands: typeof notifyCommands === 'boolean' ? notifyCommands : undefined,
        notifyErrors: typeof notifyErrors === 'boolean' ? notifyErrors : undefined,
        notifyTasks: typeof notifyTasks === 'boolean' ? notifyTasks : undefined,
        enabled: typeof enabled === 'boolean' ? enabled : undefined,
      })
      res.json({ success: true, message: 'Discord integration configured' })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Invalid configuration' })
    }
  })

  router.post('/integrations/discord/test', async (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      const { webhookUrl } = req.body
      if (!webhookUrl || typeof webhookUrl !== 'string') {
        return res.status(400).json({ error: 'webhookUrl is required' })
      }
      if (webhookUrl.length > MAX_WEBHOOK_URL_LENGTH) {
        return res.status(400).json({ error: 'Invalid webhook URL' })
      }
      await integrationManager.testDiscordWebhook(webhookUrl)
      res.json({ success: true, message: 'Test message sent' })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Test failed' })
    }
  })

  router.post('/integrations/telegram', (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      const { botToken, chatId, notifyCommands, notifyErrors, notifyTasks, enabled } = req.body

      if (botToken && (typeof botToken !== 'string' || botToken.length > MAX_TOKEN_LENGTH)) {
        return res.status(400).json({ error: 'Invalid bot token' })
      }

      integrationManager.configureTelegram({
        botToken,
        chatId: typeof chatId === 'string' ? chatId.slice(0, 20) : undefined,
        notifyCommands: typeof notifyCommands === 'boolean' ? notifyCommands : undefined,
        notifyErrors: typeof notifyErrors === 'boolean' ? notifyErrors : undefined,
        notifyTasks: typeof notifyTasks === 'boolean' ? notifyTasks : undefined,
        enabled: typeof enabled === 'boolean' ? enabled : undefined,
      })
      res.json({ success: true, message: 'Telegram integration configured' })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Invalid configuration' })
    }
  })

  router.post('/integrations/telegram/test', async (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      const { botToken, chatId } = req.body
      if (!botToken || typeof botToken !== 'string' || !chatId || typeof chatId !== 'string') {
        return res.status(400).json({ error: 'botToken and chatId are required' })
      }
      if (botToken.length > MAX_TOKEN_LENGTH || chatId.length > 20) {
        return res.status(400).json({ error: 'Invalid input' })
      }
      await integrationManager.testTelegram(botToken, chatId)
      res.json({ success: true, message: 'Test message sent' })
    } catch (err) {
      res.status(400).json({ error: err.message || 'Test failed' })
    }
  })

  return router
}

module.exports = { createRoutes }
