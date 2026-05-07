/**
 * Chiffrement AES-256-GCM symétrique.
 * Utilisé pour stocker des credentials sensibles (API keys) dans la DB
 * sans les exposer en clair.
 *
 * Clé : variable d'env INTEGRATIONS_SECRET_KEY (hex 64 chars = 32 bytes).
 * Générer : openssl rand -hex 32
 *
 * En mode dev (clé absente) : pas de chiffrement, stockage base64 simple
 * avec préfixe "plain:" pour faciliter le debug local.
 */

const KEY_ENV = "INTEGRATIONS_SECRET_KEY"

function getKey(): { buffer: ArrayBuffer; raw: Buffer } | null {
  const hex = process.env[KEY_ENV]
  if (!hex || hex.length < 64) return null
  const raw = Buffer.from(hex.slice(0, 64), "hex")
  // Slice garantit un ArrayBuffer (pas SharedArrayBuffer) pour WebCrypto
  const buffer = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer
  return { buffer, raw }
}

/**
 * Chiffre une chaîne. Retourne une string base64 qui inclut IV + tag + ciphertext.
 * Format : base64(iv[12] + tag[16] + ciphertext[*])
 */
export async function encrypt(plain: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto") as typeof import("crypto")
  const keyData = getKey()
  if (!keyData) return `plain:${Buffer.from(plain).toString("base64")}`

  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw", keyData.buffer, { name: "AES-GCM" }, false, ["encrypt"],
    )
    const enc = new TextEncoder()
    const cipherBuf = await globalThis.crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, cryptoKey, enc.encode(plain),
    )
    const result = new Uint8Array(12 + cipherBuf.byteLength)
    result.set(iv, 0)
    result.set(new Uint8Array(cipherBuf), 12)
    return Buffer.from(result).toString("base64")
  }

  // Fallback Node.js crypto
  const iv = nodeCrypto.randomBytes(12)
  const cipher = nodeCrypto.createCipheriv("aes-256-gcm", keyData.raw, iv)
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, tag, ciphertext])
  return combined.toString("base64")
}

/**
 * Déchiffre une chaîne produite par encrypt().
 */
export async function decrypt(cipherB64: string): Promise<string> {
  if (cipherB64.startsWith("plain:")) {
    return Buffer.from(cipherB64.slice(6), "base64").toString("utf8")
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const nodeCrypto = require("crypto") as typeof import("crypto")
  const keyData = getKey()
  if (!keyData) throw new Error("INTEGRATIONS_SECRET_KEY manquante")

  const combined = Buffer.from(cipherB64, "base64")

  if (typeof globalThis.crypto?.subtle !== "undefined") {
    const iv = combined.slice(0, 12)
    const cipherBuf = combined.slice(12)
    const buf = cipherBuf.buffer.slice(cipherBuf.byteOffset, cipherBuf.byteOffset + cipherBuf.byteLength) as ArrayBuffer
    const ivBuf = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer
    const cryptoKey = await globalThis.crypto.subtle.importKey(
      "raw", keyData.buffer, { name: "AES-GCM" }, false, ["decrypt"],
    )
    const plainBuf = await globalThis.crypto.subtle.decrypt(
      { name: "AES-GCM", iv: ivBuf }, cryptoKey, buf,
    )
    return new TextDecoder().decode(plainBuf)
  }

  // Fallback Node.js crypto
  const iv = combined.slice(0, 12)
  const tag = combined.slice(12, 28)
  const ciphertext = combined.slice(28)
  const decipher = nodeCrypto.createDecipheriv("aes-256-gcm", keyData.raw, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final("utf8")
}

/**
 * Helpers haut niveau : chiffre/déchiffre un objet JSON entier.
 */
export async function encryptJson(obj: unknown): Promise<string> {
  return encrypt(JSON.stringify(obj))
}

export async function decryptJson<T>(cipherB64: string): Promise<T> {
  const json = await decrypt(cipherB64)
  return JSON.parse(json) as T
}
