import crypto from "node:crypto";

/**
 * Verifies the `X-Hub-Signature-256` header GitHub sends on every webhook.
 *
 * Two details that are easy to get wrong and would silently make this
 * whole check pointless:
 *  1. The signature is computed over the *raw request body bytes*, not the
 *     parsed/re-serialized JSON. Re-serializing (even with identical
 *     content) can produce different bytes (key order, whitespace) and
 *     break verification. The webhook route reads `request.text()` and
 *     passes that raw string straight in here, only parsing JSON after
 *     the signature checks out.
 *  2. Comparison must be constant-time (`crypto.timingSafeEqual`), not
 *     `===`, or the check leaks timing information an attacker could use
 *     to forge a valid signature byte-by-byte.
 */
export function verifyGithubSignature(
  rawBody: string,
  signatureHeader: string | null,
  webhookSecret: string
): boolean {
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");
  const expectedHeader = `sha256=${expected}`;

  const a = Buffer.from(signatureHeader, "utf8");
  const b = Buffer.from(expectedHeader, "utf8");

  // timingSafeEqual throws if lengths differ, which would itself be a
  // (harmless) information leak path if unhandled — guard explicitly.
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
