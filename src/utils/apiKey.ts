import crypto from 'crypto';

export function generateApiKey(): string {
  // Generate a random 32-byte buffer
  const buffer = crypto.randomBytes(32);
  
  // Convert to base64 and remove any non-alphanumeric characters
  return buffer.toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 32);
} 