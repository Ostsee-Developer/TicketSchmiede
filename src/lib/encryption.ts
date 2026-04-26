import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32; // 256 bits

function getEncryptionKey(): Buffer {
  const hexKey = process.env.ENCRYPTION_KEY;
  if (!hexKey || hexKey.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)"
    );
  }
  return Buffer.from(hexKey, "hex");
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns: iv:authTag:ciphertext (all hex-encoded, colon-separated)
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("hex"), authTag.toString("hex"), encrypted.toString("hex")].join(":");
}

/**
 * Decrypts a string produced by encrypt().
 */
export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

/**
 * Safely decrypt - returns null on failure instead of throwing.
 */
export function safeDecrypt(encryptedData: string | null | undefined): string | null {
  if (!encryptedData) return null;
  try {
    return decrypt(encryptedData);
  } catch {
    return null;
  }
}

/**
 * Encrypt only if value is non-empty, otherwise return null.
 */
export function encryptIfPresent(value: string | null | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return encrypt(value);
}
