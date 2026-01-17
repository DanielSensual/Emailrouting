import type { LeadData, LeadParser } from "./types.js";
import { parseZillowLead } from "./parsers/zillow.js";
import { parseRealtorLead } from "./parsers/realtor.js";
import { parseFacebookLead } from "./parsers/facebook.js";
import { parseGenericLead } from "./parsers/generic.js";
import { isValidEmail } from "./validators.js";

/**
 * Chain of responsibility pattern for lead parsing
 * 
 * Parsers are tried in order of specificity:
 * 1. Zillow (most structured)
 * 2. Realtor.com
 * 3. Facebook Lead Ads
 * 4. Generic (fallback)
 * 
 * Returns the first successful parse, or throws if no parser matches.
 */
const parsers: LeadParser[] = [
    parseZillowLead,
    parseRealtorLead,
    parseFacebookLead,
    parseGenericLead, // Always last - catches anything with an email
];

/**
 * Parse lead data from email text content
 * 
 * @param text - The email body text (plain text preferred)
 * @param subject - The email subject line
 * @returns Parsed lead data
 * @throws Error if no parser can extract valid lead data
 */
export function parseLeadFromText(text: string, subject: string = ""): LeadData {
    for (const parser of parsers) {
        const result = parser(text, subject);

        if (result && isValidEmail(result.email)) {
            console.log(`[Parser] Matched source: ${result.source}`);
            return result;
        }
    }

    throw new Error(
        "Could not parse lead data from email. No valid email address found."
    );
}

/**
 * Try to parse without throwing - returns null on failure
 */
export function tryParseLeadFromText(
    text: string,
    subject: string = ""
): LeadData | null {
    try {
        return parseLeadFromText(text, subject);
    } catch {
        return null;
    }
}

/**
 * Get all possible parsers (for testing/debugging)
 */
export function getAllParsers(): LeadParser[] {
    return [...parsers];
}

// Re-export types and validators
export type { LeadData, LeadParser, LeadSource, ValidationResult } from "./types.js";
export {
    isValidEmail,
    isValidPhone,
    normalizePhone,
    formatPhone,
    normalizeName,
    extractEmails,
    extractPhones,
    normalizeWhitespace,
} from "./validators.js";
