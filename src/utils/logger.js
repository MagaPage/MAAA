const winston = require('winston')

function createLogger(config) {
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
    transports: [
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
    ],
  })
}

module.exports = { createLogger }
