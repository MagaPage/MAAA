const express = require('express')

function createRoutes(botManager, skillController, llmInterface, contextGenerator, leash, integrationManager) {
  const router = express.Router()

  router.post('/command', async (req, res) => {
    try {
      const { message } = req.body
      if (!message) {
        return res.status(400).json({ error: 'Message is required' })
      }

      const context = contextGenerator.generate()
      const command = await llmInterface.processWithHistory(message, context)

      if (!command.success) {
        return res.status(400).json({
          error: 'Failed to parse command',
          details: command.error,
          raw: command.raw,
        })
      }

      const result = await skillController.execute(command)

      if (integrationManager) {
        integrationManager.notifyCommand(message, command.action)
      }

      res.json({ command, result })
    } catch (err) {
      if (integrationManager) {
        integrationManager.notifyError(err.message)
      }
      res.status(500).json({ error: err.message })
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
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/disconnect', async (_req, res) => {
    try {
      await botManager.disconnect()
      res.json({ message: 'Bot disconnected' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/leash', (req, res) => {
    const { maxDistance, enabled, override } = req.body

    if (maxDistance !== undefined) {
      leash.maxDistance = maxDistance
    }

    if (enabled === true) {
      leash.enable()
    } else if (enabled === false) {
      leash.disable()
    }

    if (override && botManager.bot?.entity) {
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
      integrationManager.configureDiscord(req.body)
      res.json({ success: true, message: 'Discord integration configured' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/integrations/discord/test', async (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      const { webhookUrl } = req.body
      if (!webhookUrl) {
        return res.status(400).json({ error: 'webhookUrl is required' })
      }
      await integrationManager.testDiscordWebhook(webhookUrl)
      res.json({ success: true, message: 'Test message sent' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/integrations/telegram', (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      integrationManager.configureTelegram(req.body)
      res.json({ success: true, message: 'Telegram integration configured' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  router.post('/integrations/telegram/test', async (req, res) => {
    if (!integrationManager) {
      return res.status(503).json({ error: 'Integration manager not available' })
    }

    try {
      const { botToken, chatId } = req.body
      if (!botToken || !chatId) {
        return res.status(400).json({ error: 'botToken and chatId are required' })
      }
      await integrationManager.testTelegram(botToken, chatId)
      res.json({ success: true, message: 'Test message sent' })
    } catch (err) {
      res.status(500).json({ error: err.message })
    }
  })

  return router
}

module.exports = { createRoutes }
