import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
} from "node:crypto";

const EMAIL_ENCRYPTION_PREFIX = "v1";

export function normalizeSimulationEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function hashSimulationEmailAddress(
  email: string,
  secret: string,
): string {
  return createHmac("sha256", secret).update(email).digest("hex");
}

export function encryptSimulationEmailAddress(
  email: string,
  secret: string,
): string {
  const key = deriveEncryptionKey(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(email, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    EMAIL_ENCRYPTION_PREFIX,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptSimulationEmailAddress(
  encrypted: string,
  secret: string,
): string {
  const [version, ivRaw, tagRaw, ciphertextRaw] = encrypted.split(".");

  if (
    version !== EMAIL_ENCRYPTION_PREFIX ||
    !ivRaw ||
    !tagRaw ||
    !ciphertextRaw
  ) {
    throw new Error("Unsupported encrypted email payload");
  }

  const key = deriveEncryptionKey(secret);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(ivRaw, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextRaw, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}

function deriveEncryptionKey(secret: string): Buffer {
  return createHash("sha256").update(secret).digest();
}
