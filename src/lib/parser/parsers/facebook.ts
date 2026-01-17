import type { LeadData, LeadParser } from "../types.js";
import {
    extractEmails,
    extractPhones,
    isValidEmail,
    normalizeName,
} from "../validators.js";

/**
 * Facebook Lead Ads email parser
 * 
 * Facebook sends lead notifications with:
 * - "New lead from [Page Name]" in subject
 * - Form field values in the body
 */
export const parseFacebookLead: LeadParser = (text, subject) => {
    // Check if this is a Facebook lead email
    const isFacebook =
        subject.toLowerCase().includes("facebook") ||
        subject.toLowerCase().includes("new lead from") ||
        text.toLowerCase().includes("facebook.com") ||
        text.toLowerCase().includes("fb.com") ||
        text.toLowerCase().includes("lead ad");

    if (!isFacebook) {
        return null;
    }

    const rawData: Record<string, string> = {};

    // Facebook leads often have fields like:
    // full_name: John Smith
    // email: john@example.com
    // phone_number: 555-123-4567

    // Extract name
    const namePatterns = [
        /(?:full_name|name|first_name\s*(?:&|and)?\s*last_name):\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
        /first_name:\s*([A-Za-z]+)/i,
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

    // Try separate first/last name fields
    if (!lastName) {
        const lastNameMatch = text.match(/last_name:\s*([A-Za-z]+)/i);
        if (lastNameMatch) {
            lastName = normalizeName(lastNameMatch[1]);
        }
    }

    // Extract email
    const emailPatterns = [
        /(?:email|e-mail|email_address):\s*([^\s@]+@[^\s@]+\.[^\s@]+)/i,
    ];

    let email: string | undefined;
    for (const pattern of emailPatterns) {
        const match = text.match(pattern);
        if (match && isValidEmail(match[1])) {
            email = match[1].toLowerCase();
            break;
        }
    }

    if (!email) {
        const emails = extractEmails(text);
        const leadEmails = emails.filter(
            (e) =>
                !e.includes("facebook") &&
                !e.includes("fb.com") &&
                !e.includes("facebookmail")
        );
        email = leadEmails[0];
    }

    if (!email) {
        return null;
    }

    // Extract phone
    const phonePatterns = [
        /(?:phone|phone_number|mobile|cell):\s*([\d\s\-().+]+)/i,
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

    // Extract any custom fields
    const fieldPattern = /(\w+):\s*([^\n]+)/g;
    let fieldMatch;
    while ((fieldMatch = fieldPattern.exec(text)) !== null) {
        const key = fieldMatch[1].toLowerCase();
        const value = fieldMatch[2].trim();
        if (
            !["email", "phone", "name", "full_name", "first_name", "last_name"].includes(key)
        ) {
            rawData[key] = value;
        }
    }

    return {
        email,
        firstName,
        lastName,
        phone,
        source: "facebook",
        rawData,
    };
};
