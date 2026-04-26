const crypto = require('crypto')

/**
 * Create authentication middleware for the dashboard.
 * If DASHBOARD_PASSWORD is set, all routes require a valid session token.
 * Token is obtained via POST /api/auth/login with the correct password.
 * @param {object} config - Application config
 * @param {object} logger - Winston logger
 * @returns {{ authMiddleware: Function, authRouter: Function }} Middleware and router factory
 */
function createAuth(config, logger) {
  const password = config.web?.dashboardPassword
  const sessions = new Map()
  const SESSION_TTL = 24 * 60 * 60 * 1000

  /**
   * Generate a secure random session token.
   * @returns {string} Hex token
   */
  function generateToken() {
    return crypto.randomBytes(32).toString('hex')
  }

  /**
   * Clean up expired sessions periodically.
   */
  function cleanupSessions() {
    const now = Date.now()
    for (const [token, data] of sessions) {
      if (now - data.createdAt > SESSION_TTL) {
        sessions.delete(token)
      }
    }
  }

  const cleanupTimer = setInterval(cleanupSessions, 60 * 60 * 1000)
  cleanupTimer.unref()

  /**
   * Express middleware that enforces authentication when DASHBOARD_PASSWORD is set.
   * Skips auth check if no password is configured (open access).
   * @param {object} req - Express request
   * @param {object} res - Express response
   * @param {Function} next - Next middleware
   */
  function authMiddleware(req, res, next) {
    if (!password) {
      return next()
    }

    if (req.path === '/api/auth/login' || req.path === '/api/auth/status' || req.path === '/api/health') {
      return next()
    }

    const token = req.headers['x-auth-token'] || req.query.token
    if (!token || !sessions.has(token)) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const session = sessions.get(token)
    if (Date.now() - session.createdAt > SESSION_TTL) {
      sessions.delete(token)
      return res.status(401).json({ error: 'Session expired' })
    }

    next()
  }

  /**
   * Create auth-related Express routes.
   * @param {object} router - Express router
   */
  function mountAuthRoutes(router) {
    router.post('/auth/login', (req, res) => {
      if (!password) {
        return res.json({ success: true, message: 'No authentication required' })
      }

      const { password: inputPassword } = req.body
      if (!inputPassword || typeof inputPassword !== 'string') {
        return res.status(400).json({ error: 'Password is required' })
      }

      const maxLen = Math.max(inputPassword.length, password.length)
      const inputBuf = Buffer.alloc(maxLen)
      const passBuf = Buffer.alloc(maxLen)
      Buffer.from(inputPassword).copy(inputBuf)
      Buffer.from(password).copy(passBuf)

      const isValid = crypto.timingSafeEqual(inputBuf, passBuf)

      if (!isValid) {
        logger.warn('Failed dashboard login attempt')
        return res.status(401).json({ error: 'Invalid password' })
      }

      const token = generateToken()
      sessions.set(token, { createdAt: Date.now() })
      logger.info('Dashboard login successful')
      res.json({ success: true, token })
    })

    router.post('/auth/logout', (req, res) => {
      const token = req.headers['x-auth-token']
      if (token) {
        sessions.delete(token)
      }
      res.json({ success: true })
    })

    router.get('/auth/status', (_req, res) => {
      res.json({ authRequired: !!password })
    })
  }

  /**
   * Validate a Socket.io connection token.
   * @param {string} token - Session token
   * @returns {boolean} Whether the token is valid
   */
  function validateSocketToken(token) {
    if (!password) return true
    if (!token || !sessions.has(token)) return false
    const session = sessions.get(token)
    return Date.now() - session.createdAt <= SESSION_TTL
  }

  /**
   * Clean up resources (intervals) when shutting down.
   */
  function cleanup() {
    clearInterval(cleanupTimer)
  }

  return { authMiddleware, mountAuthRoutes, validateSocketToken, cleanup }
}

module.exports = { createAuth }
