import crypto from 'crypto';

/**
 * Clean up base32 input to standard string value
 */
export function decodeBase32(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const cleaned = str.toUpperCase().replace(/=+$/, '').replace(/[\s-]/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) {
      throw new Error(`Invalid base32 character: ${cleaned[i]}`);
    }
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generate a standard Base32 encoded secure 2FA secret of sixteen characters
 */
export function generateSecret(length = 16): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += alphabet[randomBytes[i] % alphabet.length];
  }
  return result;
}

/**
 * Generate standard RFC 6238 TOTP with respect to a given timestamp
 */
export function generateTOTP(secret: string, time = Date.now()): string {
  const key = decodeBase32(secret);
  const epoch = Math.floor(time / 1000);
  const counter = Math.floor(epoch / 30);

  const buffer = Buffer.alloc(8);
  const high = Math.floor(counter / 0x100000000);
  const low = counter % 0x100000000;
  buffer.writeUInt32BE(high, 0);
  buffer.writeUInt32BE(low, 4);

  const hmac = crypto.createHmac('sha1', key);
  hmac.update(buffer);
  const hmacResult = hmac.digest();

  const offset = hmacResult[hmacResult.length - 1] & 0xf;
  const code =
    ((hmacResult[offset] & 0x7f) << 24) |
    ((hmacResult[offset + 1] & 0xff) << 16) |
    ((hmacResult[offset + 2] & 0xff) << 8) |
    (hmacResult[offset + 3] & 0xff);

  const otp = (code % 1000000).toString().padStart(6, '0');
  return otp;
}

/**
 * Verify TOTP within a window of ±1 interval step to prevent device-server network lag issues
 */
export function verifyTOTP(token: string, secret: string): boolean {
  const current = Date.now();
  const step = 30000; // 30 seconds
  for (let i = -1; i <= 1; i++) {
    const expected = generateTOTP(secret, current + i * step);
    if (expected === token.trim()) {
      return true;
    }
  }
  return false;
}
