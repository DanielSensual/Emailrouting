/**
 * Gmail uses URL-safe Base64 (base64url), not standard Base64.
 * These utilities handle the conversion.
 */

/**
 * Decode Gmail's base64url-encoded content to a Buffer
 */
export function base64UrlToBuffer(b64url: string): Buffer {
    // Replace URL-safe characters with standard Base64 characters
    const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if necessary (Base64 requires length to be multiple of 4)
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);

    return Buffer.from(padded, "base64");
}

/**
 * Encode a Buffer to Gmail's base64url format
 */
export function bufferToBase64Url(buf: Buffer): string {
    return buf
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, ""); // Remove trailing padding
}

/**
 * Decode base64url string directly to a UTF-8 string
 */
export function base64UrlToString(b64url: string): string {
    return base64UrlToBuffer(b64url).toString("utf-8");
}

/**
 * Encode a UTF-8 string to base64url
 */
export function stringToBase64Url(str: string): string {
    return bufferToBase64Url(Buffer.from(str, "utf-8"));
}
