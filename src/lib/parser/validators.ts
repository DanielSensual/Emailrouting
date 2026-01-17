/**
 * Email validation using a reasonable regex
 * Covers most real-world email formats without being overly strict
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim().toLowerCase());
}

/**
 * Extract and normalize a phone number
 * Removes all non-digit characters except for leading +
 */
export function normalizePhone(phone: string): string {
    // Keep leading + for international numbers
    const hasPlus = phone.trim().startsWith("+");
    const digits = phone.replace(/\D/g, "");

    return hasPlus ? `+${digits}` : digits;
}

/**
 * Check if a phone number is valid (reasonable length)
 */
export function isValidPhone(phone: string): boolean {
    const normalized = normalizePhone(phone);
    const digitsOnly = normalized.replace(/^\+/, "");

    // Valid phone numbers are typically 7-15 digits
    return digitsOnly.length >= 7 && digitsOnly.length <= 15;
}

/**
 * Format a phone number for display
 * Handles US numbers (10 digits) specially
 */
export function formatPhone(phone: string): string {
    const normalized = normalizePhone(phone);
    const digitsOnly = normalized.replace(/^\+/, "");

    // Format US numbers as (XXX) XXX-XXXX
    if (digitsOnly.length === 10) {
        return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
    }

    // Format 11-digit US numbers with country code
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
        return `+1 (${digitsOnly.slice(1, 4)}) ${digitsOnly.slice(4, 7)}-${digitsOnly.slice(7)}`;
    }

    return normalized;
}

/**
 * Normalize a name (capitalize first letter of each word)
 */
export function normalizeName(name: string): string {
    return name
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

/**
 * Extract email addresses from text
 */
export function extractEmails(text: string): string[] {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text.match(emailRegex) || [];
    return [...new Set(matches.map((e) => e.toLowerCase()))];
}

/**
 * Extract phone numbers from text
 */
export function extractPhones(text: string): string[] {
    // Match various phone formats
    const phonePatterns = [
        /\+?1?[-.\s]?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
        /\b[0-9]{10,11}\b/g,
    ];

    const phones: string[] = [];
    for (const pattern of phonePatterns) {
        const matches = text.match(pattern) || [];
        phones.push(...matches);
    }

    // Normalize and dedupe
    const normalized = phones.map(normalizePhone).filter(isValidPhone);
    return [...new Set(normalized)];
}

/**
 * Clean up whitespace and normalize line breaks
 */
export function normalizeWhitespace(text: string): string {
    return text
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .replace(/\t/g, " ")
        .replace(/ +/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}
