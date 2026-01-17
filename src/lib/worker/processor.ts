import type { gmail_v1 } from "googleapis";
import { prisma } from "../db.js";
import { extractLeadData } from "../gmail/extract.js";
import { sendLeadReply } from "../gmail/send.js";
import { pickAgentRoundRobin } from "./assign.js";
import { notifyFailure } from "../alerts/webhook.js";

const SENDER_EMAIL = process.env.SENDER_EMAIL || "leads@example.com";
const SENDER_NAME = process.env.SENDER_NAME || "Your Company";

export interface ProcessResult {
    messageId: string;
    success: boolean;
    leadId?: string;
    agentName?: string;
    error?: string;
}

/**
 * Process a single Gmail message
 * 
 * This is the core pipeline:
 * 1. Mark as PROCESSING (creates dead-letter entry)
 * 2. Extract lead data from email
 * 3. Assign to agent via round-robin
 * 4. Upsert lead in database
 * 5. Send reply email (with idempotency check)
 * 6. Mark as SUCCESS and remove UNREAD label
 * 
 * On failure:
 * - Mark as FAILED with error log
 * - Keep email unread in Gmail
 * - Send alert notification
 */
export async function processMessage(
    gmail: gmail_v1.Gmail,
    messageId: string
): Promise<ProcessResult> {
    const startTime = Date.now();

    // Step 1: Create or update dead-letter entry with PROCESSING status
    const existingEntry = await prisma.processedMessage.findUnique({
        where: { messageId },
    });

    const attempts = (existingEntry?.attempts ?? 0) + 1;

    await prisma.processedMessage.upsert({
        where: { messageId },
        update: {
            attempts,
            lastAttemptAt: new Date(),
            status: "PROCESSING",
            errorLog: null,
        },
        create: {
            messageId,
            attempts: 1,
            lastAttemptAt: new Date(),
            status: "PROCESSING",
        },
    });

    console.log(`[Processor] Processing message ${messageId} (attempt ${attempts})`);

    try {
        // Step 2: Extract lead data from email
        const { lead, meta } = await extractLeadData(gmail, messageId);

        console.log(`[Processor] Extracted lead: ${lead.email} from ${lead.source}`);

        // Step 3: Assign agent via round-robin
        const agent = await pickAgentRoundRobin();

        // Step 4: Upsert lead in database
        const existingLead = await prisma.lead.findUnique({
            where: { email: lead.email },
        });

        const upsertedLead = await prisma.lead.upsert({
            where: { email: lead.email },
            update: {
                firstName: lead.firstName ?? existingLead?.firstName,
                lastName: lead.lastName ?? existingLead?.lastName,
                phone: lead.phone ?? existingLead?.phone,
                source: lead.source,
                sourceMessage: messageId,
                assignedAgentId: agent.id,
                assignedAt: new Date(),
            },
            create: {
                email: lead.email,
                firstName: lead.firstName,
                lastName: lead.lastName,
                phone: lead.phone,
                source: lead.source,
                sourceMessage: messageId,
                assignedAgentId: agent.id,
                assignedAt: new Date(),
            },
        });

        console.log(`[Processor] Lead ${existingLead ? "updated" : "created"}: ${upsertedLead.id}`);

        // Step 5: Send reply email (with idempotency check)
        if (!upsertedLead.replySentAt) {
            await sendLeadReply({
                gmail,
                to: upsertedLead.email,
                from: `${SENDER_NAME} <${SENDER_EMAIL}>`,
                subject: "Got it. Here's the next step",
                agentName: agent.name,
                bookingUrl: agent.bookingUrl || "https://calendly.com/your-company",
            });

            // Mark reply as sent
            await prisma.lead.update({
                where: { id: upsertedLead.id },
                data: { replySentAt: new Date() },
            });

            console.log(`[Processor] Reply sent to ${upsertedLead.email}`);
        } else {
            console.log(`[Processor] Skipped sending reply (already sent at ${upsertedLead.replySentAt})`);
        }

        // Step 6: Mark as SUCCESS
        await prisma.processedMessage.update({
            where: { messageId },
            data: {
                status: "SUCCESS",
                errorLog: null,
            },
        });

        // Step 7: Mark email as read in Gmail
        await gmail.users.messages.modify({
            userId: "me",
            id: messageId,
            requestBody: {
                removeLabelIds: ["UNREAD"],
            },
        });

        const duration = Date.now() - startTime;
        console.log(`[Processor] ✓ Message ${messageId} processed successfully in ${duration}ms`);

        return {
            messageId,
            success: true,
            leadId: upsertedLead.id,
            agentName: agent.name,
        };
    } catch (error: any) {
        const errorMessage = error?.stack || error?.message || String(error);

        console.error(`[Processor] ✗ Failed to process message ${messageId}:`, errorMessage);

        // Update dead-letter entry with FAILED status
        await prisma.processedMessage.update({
            where: { messageId },
            data: {
                status: "FAILED",
                errorLog: errorMessage,
            },
        });

        // Send failure alert
        await notifyFailure({
            messageId,
            error: errorMessage,
            attempts,
        }).catch((alertError) => {
            console.error("[Processor] Failed to send alert:", alertError);
        });

        // Email stays unread in Gmail - no modification needed

        return {
            messageId,
            success: false,
            error: errorMessage,
        };
    }
}

/**
 * Retry failed messages
 * 
 * Fetches messages with FAILED status and attempts to reprocess them.
 * Respects maximum retry attempts.
 */
export async function retryFailedMessages(
    gmail: gmail_v1.Gmail,
    maxAttempts: number = 3
): Promise<ProcessResult[]> {
    const failedMessages = await prisma.processedMessage.findMany({
        where: {
            status: "FAILED",
            attempts: { lt: maxAttempts },
        },
        orderBy: { lastAttemptAt: "asc" },
        take: 10, // Process 10 at a time
    });

    console.log(`[Processor] Found ${failedMessages.length} failed messages to retry`);

    const results: ProcessResult[] = [];

    for (const msg of failedMessages) {
        const result = await processMessage(gmail, msg.messageId);
        results.push(result);
    }

    return results;
}

/**
 * Get processing summary for a time period
 */
export async function getProcessingSummary(since: Date) {
    const [total, success, failed] = await Promise.all([
        prisma.processedMessage.count({
            where: { processedAt: { gte: since } },
        }),
        prisma.processedMessage.count({
            where: { processedAt: { gte: since }, status: "SUCCESS" },
        }),
        prisma.processedMessage.count({
            where: { processedAt: { gte: since }, status: "FAILED" },
        }),
    ]);

    return {
        total,
        success,
        failed,
        successRate: total > 0 ? ((success / total) * 100).toFixed(1) + "%" : "N/A",
    };
}
