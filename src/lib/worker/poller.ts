import type { gmail_v1 } from "googleapis";
import { prisma } from "../db.js";

const DEFAULT_MAX_MESSAGES = 50;
const DEFAULT_RATE_LIMIT_MS = 100; // 100ms between API calls

export interface PollOptions {
    /** Gmail label to filter by (optional) */
    labelFilter?: string;
    /** Maximum messages to process per run */
    maxMessages?: number;
    /** Delay between Gmail API calls (ms) */
    rateLimitMs?: number;
}

export interface UnreadMessage {
    id: string;
    threadId: string;
}

/**
 * Poll Gmail inbox for unread messages
 * 
 * Filters out already-processed messages from the database.
 */
export async function pollUnreadMessages(
    gmail: gmail_v1.Gmail,
    options: PollOptions = {}
): Promise<UnreadMessage[]> {
    const {
        labelFilter,
        maxMessages = DEFAULT_MAX_MESSAGES,
    } = options;

    // Build the query
    let query = "is:unread";
    if (labelFilter) {
        query += ` label:${labelFilter}`;
    }

    console.log(`[Poller] Fetching unread messages with query: "${query}"`);

    // List unread messages
    const res = await gmail.users.messages.list({
        userId: "me",
        q: query,
        maxResults: maxMessages,
    });

    const messages = res.data.messages || [];
    console.log(`[Poller] Found ${messages.length} unread messages`);

    if (messages.length === 0) {
        return [];
    }

    // Get list of already-processed message IDs
    const messageIds = messages.map((m) => m.id!);
    const processed = await prisma.processedMessage.findMany({
        where: {
            messageId: { in: messageIds },
            // Only skip messages that succeeded - failed ones should retry
            status: "SUCCESS",
        },
        select: { messageId: true },
    });

    const processedIds = new Set(processed.map((p) => p.messageId));

    // Filter to only unprocessed messages
    const unprocessed = messages
        .filter((m) => !processedIds.has(m.id!))
        .map((m) => ({
            id: m.id!,
            threadId: m.threadId!,
        }));

    console.log(
        `[Poller] ${unprocessed.length} messages need processing (${processed.length} already processed)`
    );

    return unprocessed;
}

/**
 * Sleep helper for rate limiting
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Rate-limited message iterator
 */
export async function* iterateMessages(
    messages: UnreadMessage[],
    rateLimitMs: number = DEFAULT_RATE_LIMIT_MS
): AsyncGenerator<UnreadMessage> {
    for (let i = 0; i < messages.length; i++) {
        yield messages[i];

        // Rate limit between messages (except for the last one)
        if (i < messages.length - 1) {
            await sleep(rateLimitMs);
        }
    }
}

/**
 * Get count of messages in different states
 */
export async function getProcessingStats() {
    const [processing, success, failed, total] = await Promise.all([
        prisma.processedMessage.count({ where: { status: "PROCESSING" } }),
        prisma.processedMessage.count({ where: { status: "SUCCESS" } }),
        prisma.processedMessage.count({ where: { status: "FAILED" } }),
        prisma.processedMessage.count(),
    ]);

    return { processing, success, failed, total };
}
