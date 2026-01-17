import type { LeadData, LeadParser } from "../types.js";
import {
    extractEmails,
    extractPhones,
    isValidEmail,
    normalizeName,
} from "../validators.js";

/**
 * Realtor.com lead email parser
 * 
 * Realtor.com sends leads with formats like:
 * - "New Lead from Realtor.com" in subject
 * - Contact information in structured format
 */
export const parseRealtorLead: LeadParser = (text, subject) => {
    // Check if this is a Realtor.com email
    const isRealtor =
        subject.toLowerCase().includes("realtor.com") ||
        subject.toLowerCase().includes("realtor lead") ||
        text.toLowerCase().includes("realtor.com") ||
        text.toLowerCase().includes("move.com");

    if (!isRealtor) {
        return null;
    }

    const rawData: Record<string, string> = {};

    // Extract name
    const namePatterns = [
        /(?:Lead Name|Name|Contact):\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
        /([A-Z][a-z]+\s+[A-Z][a-z]+)\s+(?:is interested in|wants more info)/i,
        /from\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    ];

    let firstName: string | undefined;
    let lastName: string | undefined;

    for (const pattern of namePatterns) {
        const match = text.match(pattern);
        if (match) {
            const fullName = normalizeName(match[1]);
            const nameParts = fullName.split(/\s+/);
            firstName = nameParts[0];
            lastName = nameParts.slice(1).join(" ") || undefined;
            rawData.fullName = fullName;
            break;
        }
    }

    // Extract email
    const emailPatterns = [
        /(?:Email|E-mail):\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
        /(?:Contact|Reply to):\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
    ];

    let email: string | undefined;
    for (const pattern of emailPatterns) {
        const match = text.match(pattern);
        if (match && isValidEmail(match[1])) {
            email = match[1].toLowerCase();
            break;
        }
    }

    // Fallback: extract any email from text
    if (!email) {
        const emails = extractEmails(text);
        // Filter out Realtor's own emails
        const leadEmails = emails.filter(
            (e) =>
                !e.includes("realtor.com") &&
                !e.includes("move.com") &&
                !e.includes("noreply")
        );
        email = leadEmails[0];
    }

    if (!email) {
        return null;
    }

    // Extract phone
    const phonePatterns = [
        /(?:Phone|Mobile|Cell|Tel(?:ephone)?):\s*([\d\s\-().+]+)/i,
    ];

    let phone: string | undefined;
    for (const pattern of phonePatterns) {
        const match = text.match(pattern);
        if (match) {
            phone = match[1].trim();
            break;
        }
    }

    if (!phone) {
        const phones = extractPhones(text);
        phone = phones[0];
    }

    // Extract property info
    const propertyMatch = text.match(
        /(?:Property|Listing|Address):\s*(.+?)(?:\n|$)/i
    );
    if (propertyMatch) {
        rawData.propertyAddress = propertyMatch[1].trim();
    }

    // Extract price if present
    const priceMatch = text.match(/\$[\d,]+(?:\.\d{2})?/);
    if (priceMatch) {
        rawData.price = priceMatch[0];
    }

    return {
        email,
        firstName,
        lastName,
        phone,
        source: "realtor",
        rawData,
    };
};
