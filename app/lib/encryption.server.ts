import crypto from 'crypto';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const KEY_LENGTH = 32;

/**
 * Derive encryption key from SESSION_SECRET
 */
function deriveKey(salt: Buffer): Buffer {
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret) {
    throw new Error('SESSION_SECRET environment variable is required for encryption');
  }
  
  return crypto.pbkdf2Sync(sessionSecret, salt, 100000, KEY_LENGTH, 'sha512');
}

/**
 * Encrypt sensitive data (like NWC connection strings)
 */
export function encrypt(text: string): string {
  try {
    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = deriveKey(salt);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine salt + iv + encrypted data
    const combined = Buffer.concat([
      salt,
      iv,
      Buffer.from(encrypted, 'hex')
    ]);
    
    return combined.toString('base64');
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  try {
    const combined = Buffer.from(encryptedData, 'base64');
    
    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH);
    
    const key = deriveKey(salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, undefined, 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Validate NWC connection string format
 */
export function validateNWCString(nwcString: string): boolean {
  try {
    // Basic validation for NWC format
    return nwcString.startsWith('nostr+walletconnect://') && nwcString.length > 30;
  } catch {
    return false;
  }
}

/**
 * Mask NWC string for display (show only first and last few characters)
 */
export function maskNWCString(nwcString: string): string {
  if (!nwcString || nwcString.length < 10) {
    return '***';
  }
  
  const prefix = nwcString.substring(0, 25); // nostr+walletconnect://
  const visible = nwcString.substring(25, 29); // First few chars after protocol
  const masked = '...';
  const suffix = nwcString.substring(nwcString.length - 4); // Last 4 chars
  
  return `${prefix}${visible}${masked}${suffix}`;
}