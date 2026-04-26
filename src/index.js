const readline = require('readline')
const { loadConfig } = require('./config')
const { createLogger } = require('./utils/logger')
const { Authenticator } = require('./auth/authenticator')
const { BotManager } = require('./bot/botManager')
const { Leash } = require('./bot/leash')
const { SkillController } = require('./bot/skillController')
const { Navigator } = require('./engine/navigator')
const { Builder } = require('./engine/builder')
const { Miner } = require('./engine/miner')
const { ContextGenerator } = require('./ai/contextGenerator')
const { LLMInterface } = require('./ai/llmInterface')
const { DashboardServer } = require('./web/server')

async function main() {
  const config = loadConfig()
  const logger = createLogger(config)

  logger.info('=== MAAA - Minecraft AI Architect & Automator ===')
  logger.info('Starting up...')

  // Step 1: Authentication
  const authenticator = new Authenticator(config)
  authenticator.on('deviceCode', (code) => {
    logger.info('=========================================')
    logger.info(`To sign in, visit: ${code.verificationUri}`)
    logger.info(`Enter code: ${code.userCode}`)
    logger.info('=========================================')
  })

  logger.info('Authenticating with Microsoft...')
  let authResult
  try {
    authResult = await authenticator.authenticateWithCache()
    logger.info(`Authenticated as: ${authResult.profile?.name || 'unknown'}`)
  } catch (err) {
    logger.error(`Authentication failed: ${err.message}`)
    process.exit(1)
  }

  // Step 2: Create Bot
  const botManager = new BotManager(config, logger)
  let bot
  try {
    bot = await botManager.createBot(authResult.token, authResult.profile)
    logger.info('Bot connected and spawned')
  } catch (err) {
    logger.error(`Bot creation failed: ${err.message}`)
    process.exit(1)
  }

  // Step 3: Initialize Engines
  const navigator = new Navigator(bot, logger)
  const builder = new Builder(bot, navigator, logger)
  const miner = new Miner(bot, navigator, logger)

  // Step 4: Initialize AI
  const contextGenerator = new ContextGenerator(bot)
  const llmInterface = new LLMInterface(config.openai.apiKey, config.openai.model)

  // Step 5: Initialize Skill Controller
  const skillController = new SkillController(bot, builder, miner, navigator, logger)

  // Step 6: Initialize Leash
  const leash = new Leash(bot, {
    maxDistance: config.security.leashMaxDistance,
  })

  if (config.security.leashEnabled) {
    leash.enable()
    logger.info(`Soft-leash enabled: max ${config.security.leashMaxDistance} blocks`)
  }

  // Step 7: Start Dashboard
  const dashboard = new DashboardServer(config, logger)
  dashboard.mountRoutes(botManager, skillController, llmInterface, contextGenerator, leash)
  dashboard.attachBot(botManager, skillController)
  await dashboard.start()

  // Step 8: CLI Fallback
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: 'MAAA> ',
  })

  logger.info('Ready! Type commands below or use the web dashboard.')
  rl.prompt()

  rl.on('line', async (line) => {
    const input = line.trim()
    if (!input) {
      rl.prompt()
      return
    }

    if (input === 'quit' || input === 'exit') {
      logger.info('Shutting down...')
      await botManager.disconnect()
      await dashboard.stop()
      process.exit(0)
    }

    if (input === 'status') {
      const state = botManager.getState()
      console.log(JSON.stringify(state, null, 2))
      rl.prompt()
      return
    }

    if (input === 'scan') {
      const clusters = miner.scanOres()
      console.log(`Found ${clusters.length} ore clusters:`)
      for (const c of clusters) {
        console.log(`  ${c.oreType} x${c.size} at (${Math.floor(c.center.x)}, ${Math.floor(c.center.y)}, ${Math.floor(c.center.z)})`)
      }
      rl.prompt()
      return
    }

    try {
      const context = contextGenerator.generate()
      const command = await llmInterface.processWithHistory(input, context)

      if (!command.success) {
        logger.error(`Failed to parse: ${command.error}`)
        rl.prompt()
        return
      }

      logger.info(`Executing: ${command.action} ${JSON.stringify(command.params)}`)
      const result = await skillController.execute(command)
      logger.info(`Result: ${JSON.stringify(result)}`)
    } catch (err) {
      logger.error(`Error: ${err.message}`)
    }

    rl.prompt()
  })

  rl.on('close', async () => {
    logger.info('Shutting down...')
    await botManager.disconnect()
    await dashboard.stop()
    process.exit(0)
  })

  // Graceful shutdown
  process.on('SIGINT', async () => {
    logger.info('Received SIGINT. Shutting down...')
    await botManager.disconnect()
    await dashboard.stop()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Shutting down...')
    await botManager.disconnect()
    await dashboard.stop()
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
