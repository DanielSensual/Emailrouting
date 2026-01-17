import type { LeadData, LeadParser } from "../types.js";
import {
    extractEmails,
    extractPhones,
    normalizeName,
} from "../validators.js";

/**
 * Generic/fallback lead parser
 * 
 * Uses heuristic extraction when no specific parser matches.
 * This is the last resort and will try to extract any contact info.
 */
export const parseGenericLead: LeadParser = (text, subject) => {
    const rawData: Record<string, string> = {};

    // Extract all emails from the text
    const emails = extractEmails(text);

    // Filter out common system/noreply emails
    const leadEmails = emails.filter(
        (e) =>
            !e.includes("noreply") &&
            !e.includes("no-reply") &&
            !e.includes("donotreply") &&
            !e.includes("mailer-daemon") &&
            !e.includes("postmaster")
    );

    if (leadEmails.length === 0) {
        return null; // Can't create a lead without an email
    }

    const email = leadEmails[0];

    // Try to extract name from various patterns
    let firstName: string | undefined;
    let lastName: string | undefined;

    // Pattern 1: "Name: John Smith" or similar labeled fields
    const labeledNamePatterns = [
        /(?:Name|Full Name|Contact|From|Sender):\s*([A-Za-z]+(?:\s+[A-Za-z]+)?)/i,
        /(?:First Name|FirstName):\s*([A-Za-z]+)/i,
    ];

    for (const pattern of labeledNamePatterns) {
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

    // Pattern 2: Extract name from email (before @)
    if (!firstName) {
        const emailName = email.split("@")[0];
        // Try to parse names like "john.smith" or "john_smith"
        const nameParts = emailName
            .split(/[._-]/)
            .filter((p) => p.length > 1 && /^[a-zA-Z]+$/.test(p));

        if (nameParts.length >= 1) {
            firstName = normalizeName(nameParts[0]);
            if (nameParts.length >= 2) {
                lastName = normalizeName(nameParts[1]);
            }
        }
    }

    // Pattern 3: Look for greeting patterns like "Hi, I'm John" or "My name is John Smith"
    if (!firstName) {
        const greetingPatterns = [
            /(?:Hi|Hello|Hey),?\s+(?:I'm|I am|this is)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
            /(?:My name is|I'm|I am)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
        ];

        for (const pattern of greetingPatterns) {
            const match = text.match(pattern);
            if (match) {
                const fullName = normalizeName(match[1]);
                const nameParts = fullName.split(/\s+/);
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(" ") || undefined;
                break;
            }
        }
    }

    // Extract phone numbers
    const phones = extractPhones(text);
    const phone = phones[0];

    // Try to extract any key-value pairs
    const kvPattern = /^([A-Za-z\s]+):\s*(.+)$/gm;
    let kvMatch;
    while ((kvMatch = kvPattern.exec(text)) !== null) {
        const key = kvMatch[1].trim().toLowerCase().replace(/\s+/g, "_");
        const value = kvMatch[2].trim();
        if (value && !rawData[key]) {
            rawData[key] = value;
        }
    }

    // Try to determine intent from subject/content
    if (subject) {
        rawData.subject = subject;
    }

    return {
        email,
        firstName,
        lastName,
        phone,
        source: "generic",
        rawData,
    };
};
