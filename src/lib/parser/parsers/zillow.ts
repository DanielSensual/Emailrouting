import type { LeadData, LeadParser } from "../types.js";
import {
    extractEmails,
    extractPhones,
    isValidEmail,
    normalizeName,
} from "../validators.js";

/**
 * Zillow lead email parser
 * 
 * Zillow sends leads with a specific format including:
 * - "New lead from Zillow" in subject
 * - Structured content with Name:, Email:, Phone: fields
 */
export const parseZillowLead: LeadParser = (text, subject) => {
    // Check if this is a Zillow email
    const isZillow =
        subject.toLowerCase().includes("zillow") ||
        text.toLowerCase().includes("zillow.com") ||
        text.toLowerCase().includes("from zillow");

    if (!isZillow) {
        return null;
    }

    const rawData: Record<string, string> = {};

    // Extract name - Zillow formats: "Name: John Smith" or "Contact: John Smith"
    const namePatterns = [
        /(?:Name|Contact|Buyer|Seller):\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
        /(?:^|\n)([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s+is interested|\s+has requested)/i,
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
        /(?:Email|E-mail|Contact Email):\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
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
        // Filter out Zillow's own emails
        const leadEmails = emails.filter(
            (e) => !e.includes("zillow") && !e.includes("zillowgroup")
        );
        email = leadEmails[0];
    }

    if (!email) {
        return null; // Can't create a lead without an email
    }

    // Extract phone
    const phonePatterns = [
        /(?:Phone|Mobile|Cell|Tel):\s*([\d\s\-().+]+)/i,
    ];

    let phone: string | undefined;
    for (const pattern of phonePatterns) {
        const match = text.match(pattern);
        if (match) {
            phone = match[1].trim();
            break;
        }
    }

    // Fallback: extract first phone from text
    if (!phone) {
        const phones = extractPhones(text);
        phone = phones[0];
    }

    // Extract property address if present
    const addressMatch = text.match(
        /(?:Property|Address|Listing):\s*(.+?)(?:\n|$)/i
    );
    if (addressMatch) {
        rawData.propertyAddress = addressMatch[1].trim();
    }

    return {
        email,
        firstName,
        lastName,
        phone,
        source: "zillow",
        rawData,
    };
};
