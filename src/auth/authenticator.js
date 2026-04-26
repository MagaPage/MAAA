const { Authflow, Titles } = require('prismarine-auth')
const EventEmitter = require('events')
const { TokenCache } = require('./tokenCache')

class Authenticator extends EventEmitter {
  constructor(config) {
    super()
    this.config = config
    this.tokenCache = new TokenCache(
      config.tokenCacheDir,
      config.security.encryptionKey
    )
    this.authflow = null
  }

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
