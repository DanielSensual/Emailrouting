import { prisma } from "../db.js";
import { notifyFailure } from "./webhook.js";

/**
 * Get a digest of failed messages for review
 * 
 * Returns messages that have failed and not been manually resolved.
 */
export async function getFailedMessageDigest(limit: number = 20) {
    const failedMessages = await prisma.processedMessage.findMany({
        where: { status: "FAILED" },
        orderBy: { lastAttemptAt: "desc" },
        take: limit,
    });

    return failedMessages.map((msg: { messageId: string; attempts: number; lastAttemptAt: Date | null; errorLog: string | null }) => ({
        messageId: msg.messageId,
        attempts: msg.attempts,
        lastAttempt: msg.lastAttemptAt,
        error: msg.errorLog?.slice(0, 200) + (msg.errorLog && msg.errorLog.length > 200 ? "..." : ""),
    }));
}

/**
 * Send daily digest of failed messages
 */
export async function sendDailyDigest(): Promise<void> {
    const digest = await getFailedMessageDigest(10);

    if (digest.length === 0) {
        console.log("[Digest] No failed messages to report");
        return;
    }

    console.log(`[Digest] ${digest.length} failed messages:`);
    for (const msg of digest) {
        console.log(`  - ${msg.messageId}: ${msg.attempts} attempts, error: ${msg.error}`);
    }

    // Send individual notifications for high-priority failures
    const highPriority = digest.filter((d: { attempts: number }) => d.attempts >= 3);
    for (const msg of highPriority) {
        await notifyFailure({
            messageId: msg.messageId,
            error: `[Daily Digest] ${msg.error || "Unknown error"}`,
            attempts: msg.attempts,
        });
    }
}

/**
 * Get statistics for a time period
 */
export async function getDigestStats(since: Date) {
    const [totalProcessed, totalSuccess, totalFailed, totalLeads] = await Promise.all([
        prisma.processedMessage.count({ where: { processedAt: { gte: since } } }),
        prisma.processedMessage.count({ where: { processedAt: { gte: since }, status: "SUCCESS" } }),
        prisma.processedMessage.count({ where: { processedAt: { gte: since }, status: "FAILED" } }),
        prisma.lead.count({ where: { createdAt: { gte: since } } }),
    ]);

    return {
        period: {
            from: since.toISOString(),
            to: new Date().toISOString(),
        },
        messages: {
            total: totalProcessed,
            success: totalSuccess,
            failed: totalFailed,
            successRate: totalProcessed > 0
                ? ((totalSuccess / totalProcessed) * 100).toFixed(1) + "%"
                : "N/A",
        },
        leads: {
            created: totalLeads,
        },
    };
}

/**
 * Clean up old successful messages (optional maintenance)
 */
export async function cleanupOldMessages(olderThan: Date): Promise<number> {
    const result = await prisma.processedMessage.deleteMany({
        where: {
            status: "SUCCESS",
            processedAt: { lt: olderThan },
        },
    });

    console.log(`[Cleanup] Deleted ${result.count} old successful messages`);
    return result.count;
}
