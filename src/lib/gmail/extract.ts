import { simpleParser, type ParsedMail } from "mailparser";
import type { gmail_v1 } from "googleapis";
import { base64UrlToBuffer } from "./base64url.js";
import { parseLeadFromText } from "../parser/index.js";
import type { LeadData } from "../parser/types.js";

export interface ExtractedEmail {
    lead: LeadData;
    meta: {
        subject: string;
        from: string;
        to: string;
        date: Date | undefined;
        messageId: string;
    };
    raw: {
        text: string;
        html: string;
    };
}

/**
 * Extract lead data from a Gmail message using raw format + mailparser
 * 
 * This fetches the complete email content (not truncated snippets)
 * and parses it with a proper RFC822 parser.
 */
export async function extractLeadData(
    gmail: gmail_v1.Gmail,
    messageId: string
): Promise<ExtractedEmail> {
    // Fetch the raw email (base64url-encoded RFC822)
    const res = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "raw",
    });

    if (!res.data.raw) {
        throw new Error(`No raw payload returned by Gmail for message ${messageId}`);
    }

    // Decode and parse the email
    const rawBuf = base64UrlToBuffer(res.data.raw);
    const parsed: ParsedMail = await simpleParser(rawBuf);

    // Extract text and HTML bodies
    const textBody = parsed.text ?? "";
    const htmlBody = typeof parsed.html === "string" ? parsed.html : "";

    if (!textBody && !htmlBody) {
        throw new Error(
            `Email ${messageId} parsed but has no body text or HTML`
        );
    }

    // Parse lead data from the email content
    // Prefer text body; fall back to HTML
    const contentToParse = textBody || stripHtmlTags(htmlBody);
    const lead = parseLeadFromText(contentToParse, parsed.subject ?? "");

    return {
        lead,
        meta: {
            subject: parsed.subject ?? "",
            from: parsed.from?.text ?? "",
            to: parsed.to ? (Array.isArray(parsed.to) ? parsed.to.map(a => a.text).join(", ") : parsed.to.text) : "",
            date: parsed.date,
            messageId,
        },
        raw: {
            text: textBody,
            html: htmlBody,
        },
    };
}

/**
 * Simple HTML tag stripper for fallback parsing
 */
function stripHtmlTags(html: string): string {
    return html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "") // Remove style blocks
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "") // Remove script blocks
        .replace(/<[^>]+>/g, " ") // Remove all tags
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\s+/g, " ") // Normalize whitespace
        .trim();
}

/**
 * Get message metadata without fetching full content
 * Useful for filtering before full extraction
 */
export async function getMessageMetadata(
    gmail: gmail_v1.Gmail,
    messageId: string
) {
    const res = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
    });

    const headers = res.data.payload?.headers ?? [];
    const getHeader = (name: string) =>
        headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";

    return {
        messageId,
        from: getHeader("From"),
        subject: getHeader("Subject"),
        date: getHeader("Date"),
        labelIds: res.data.labelIds ?? [],
    };
}
