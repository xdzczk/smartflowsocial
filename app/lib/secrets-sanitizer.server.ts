/**
 * Secrets Sanitization Utility
 *
 * Prevents sensitive data (NWC strings, secrets, etc.) from appearing in logs or error messages
 */

/**
 * Patterns that indicate sensitive data
 */
const SENSITIVE_PATTERNS = [
  /nostr\+walletconnect:\/\/[^\s"']+/gi, // NWC connection strings
  /nsec1[a-z0-9]+/gi, // Nostr secret keys
  /encryptedNwc/gi, // Encrypted NWC field names
  /SESSION_SECRET/gi,
  /DATABASE_URL/gi,
  /REDIS_URL/gi,
  /STORAGE_(ACCESS_KEY|SECRET)/gi,
  /NOSTR_NSEC/gi,
  /OWNER_NWC/gi,
];

/**
 * Replace sensitive data with [REDACTED]
 */
export function sanitizeString(input: string): string {
  let sanitized = input;

  for (const pattern of SENSITIVE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "[REDACTED]");
  }

  return sanitized;
}

/**
 * Sanitize an object recursively, removing or masking sensitive fields
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === "string") {
    return sanitizeString(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as T;
  }

  if (typeof obj === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const lowerKey = key.toLowerCase();

      // Check if key indicates sensitive data
      if (
        lowerKey.includes("nwc") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("password") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("encrypted")
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = sanitizeObject(value);
      }
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Sanitize error message and stack trace
 */
export function sanitizeError(error: Error | unknown): {
  message: string;
  stack?: string;
  name: string;
} {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: sanitizeString(error.message),
      stack: error.stack ? sanitizeString(error.stack) : undefined,
    };
  }

  return {
    name: "Error",
    message: sanitizeString(String(error)),
  };
}

/**
 * Safe console.error that sanitizes sensitive data
 */
export function safeConsoleError(message: string, ...args: unknown[]): void {
  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map((arg) => {
    if (typeof arg === "string") {
      return sanitizeString(arg);
    }
    if (typeof arg === "object" && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });

  console.error(sanitizedMessage, ...sanitizedArgs);
}

/**
 * Safe console.log that sanitizes sensitive data
 */
export function safeConsoleLog(message: string, ...args: unknown[]): void {
  const sanitizedMessage = sanitizeString(message);
  const sanitizedArgs = args.map((arg) => {
    if (typeof arg === "string") {
      return sanitizeString(arg);
    }
    if (typeof arg === "object" && arg !== null) {
      return sanitizeObject(arg);
    }
    return arg;
  });

  console.log(sanitizedMessage, ...sanitizedArgs);
}
