/**
 * Secure Logger Utility
 *
 * Conditional logging based on environment
 * Production mode: No console logs exposed
 * Development mode: Full logging enabled
 */

const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const IS_DEVELOPMENT = process.env.NODE_ENV === 'development';

/**
 * Safe console logger that only works in development
 */
class SecureLogger {
  log(...args) {
    if (IS_DEVELOPMENT) {
      console.log(...args);
    }
  }

  warn(...args) {
    if (IS_DEVELOPMENT) {
      console.warn(...args);
    }
  }

  error(...args) {
    if (IS_DEVELOPMENT) {
      console.error(...args);
    }
  }

  debug(...args) {
    if (IS_DEVELOPMENT) {
      console.debug(...args);
    }
  }

  info(...args) {
    if (IS_DEVELOPMENT) {
      console.info(...args);
    }
  }

  table(...args) {
    if (IS_DEVELOPMENT) {
      console.table(...args);
    }
  }

  /**
   * Special method for security-sensitive operations
   * Never logs in any environment
   */
  secure() {
    // Intentionally does nothing - security-sensitive data should never be logged
    return {
      log: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
      info: () => {},
    };
  }

  /**
   * Sanitize sensitive data from objects before logging
   */
  sanitize(obj) {
    if (!obj || typeof obj !== 'object') return obj;

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'api_key',
      'apiKey',
      'authorization',
      'auth',
      'sessionId',
      'accessToken',
      'refreshToken',
      'privateKey',
      'cert',
      'certificate',
    ];

    const sanitized = { ...obj };

    for (const key of Object.keys(sanitized)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

export const logger = new SecureLogger();
export default logger;
