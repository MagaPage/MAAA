const express = require('express')

function createRoutes(botManager, skillController, llmInterface, contextGenerator, leash) {
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
      res.json({ command, result })
    } catch (err) {
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
          ? Math.floor(leash.getDistance(botManager.bot.entity.position))
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

  return router
}

module.exports = { createRoutes }
