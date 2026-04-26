const { Authflow, Titles } = require('prismarine-auth')
const EventEmitter = require('events')
const { TokenCache } = require('./tokenCache')

class Authenticator extends EventEmitter {
  /**
   * Microsoft OAuth2 authentication using device code flow.
   * @param {object} config - App config with tokenCacheDir and security.encryptionKey
   */
  constructor(config) {
    super()
    this.config = config
    this.tokenCache = new TokenCache(
      config.tokenCacheDir,
      config.security.encryptionKey
    )
    this.authflow = null
  }

  /**
   * Authenticate via Microsoft device code flow.
   * Emits 'deviceCode' with { userCode, verificationUri, message }.
   * @returns {Promise<object>} { token, profile, entitlements }
   */
  async authenticate() {
    const username = 'maaa-bot'

    this.authflow = new Authflow(
      username,
      this.config.tokenCacheDir,
      {
        flow: 'msal',
        authTitle: Titles.MinecraftJava,
      },
      (code) => {
        this.emit('deviceCode', {
          userCode: code.user_code,
          verificationUri: code.verification_uri,
          message: code.message,
        })
      }
    )

    const result = await this.authflow.getMinecraftJavaToken({
      fetchProfile: true,
      fetchEntitlements: true,
    })

    return {
      token: result.token,
      profile: result.profile,
      entitlements: result.entitlements,
    }
  }

  /**
   * Authenticate using cached tokens if valid, otherwise perform fresh auth.
   * @returns {Promise<object>} { token, profile, entitlements, expiresAt }
   */
  async authenticateWithCache() {
    const username = 'maaa-bot'
    const cached = await this.tokenCache.load(username)

    if (cached && cached.expiresAt > Date.now()) {
      return cached
    }

    const result = await this.authenticate()

    await this.tokenCache.save(username, {
      ...result,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000,
    })

    return result
  }
}

module.exports = { Authenticator }
