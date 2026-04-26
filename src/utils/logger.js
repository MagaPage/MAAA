const winston = require('winston')
const path = require('path')

/**
 * Create a Winston logger instance with console and optional file transports.
 * @param {object} [config] - Configuration with logLevel and logFile
 * @returns {winston.Logger} Configured logger
 */
function createLogger(config) {
  const transports = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, stack }) => {
          return stack
            ? `${timestamp} [${level}] ${message}\n${stack}`
            : `${timestamp} [${level}] ${message}`
        })
      ),
    }),
  ]

  if (config?.logFile) {
    const logFilePath = path.resolve(config.logFile)
    transports.push(
      new winston.transports.File({
        filename: logFilePath,
        maxsize: 10 * 1024 * 1024,
        maxFiles: 5,
        tailable: true,
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.json()
        ),
      })
    )
  }

  return winston.createLogger({
    level: config?.logLevel || 'info',
    format: winston.format.combine(
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.errors({ stack: true }),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return stack
          ? `${timestamp} [${level.toUpperCase()}] ${message}\n${stack}`
          : `${timestamp} [${level.toUpperCase()}] ${message}`
      })
    ),
    transports,
  })
}

module.exports = { createLogger }
