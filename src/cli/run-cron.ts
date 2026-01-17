#!/usr/bin/env npx tsx
/**
 * Main cron job entry point
 * 
 * This script should be run on a schedule (e.g., every minute via cron)
 * to poll the Gmail inbox and process new leads.
 * 
 * Usage:
 *   npx tsx src/cli/run-cron.ts
 *   npm run cron
 */

import "dotenv/config";
import { getGmailClient } from "../lib/gmail/index.js";
import {
    acquireLock,
    releaseLock,
    pollUnreadMessages,
    iterateMessages,
    processMessage,
    retryFailedMessages,
} from "../lib/worker/index.js";
import { notifySuccess } from "../lib/alerts/index.js";
import type { ProcessResult } from "../lib/worker/index.js";

const LOCK_NAME = "email_processor";

async function main() {
    console.log("\n========================================");
    console.log("  Email Relay - Cron Run");
    console.log(`  Started: ${new Date().toISOString()}`);
    console.log("========================================\n");

    // Step 1: Acquire lock to prevent concurrent runs
    const lockAcquired = await acquireLock(LOCK_NAME);

    if (!lockAcquired) {
        console.log("Another worker is already running. Exiting.");
        process.exit(0);
    }

    const startTime = Date.now();
    const results: ProcessResult[] = [];

    try {
        // Step 2: Get authenticated Gmail client
        const gmail = getGmailClient();
        console.log("[Cron] Gmail client authenticated\n");

        // Step 3: Poll for unread messages
        const labelFilter = process.env.GMAIL_LABEL_FILTER || undefined;
        const maxMessages = parseInt(process.env.MAX_MESSAGES_PER_RUN || "50", 10);

        const messages = await pollUnreadMessages(gmail, {
            labelFilter,
            maxMessages,
        });

        if (messages.length === 0) {
            console.log("[Cron] No new messages to process\n");
        } else {
            // Step 4: Process each message
            console.log(`\n[Cron] Processing ${messages.length} messages...\n`);

            for await (const message of iterateMessages(messages)) {
                const result = await processMessage(gmail, message.id);
                results.push(result);
            }
        }

        // Step 5: Retry any previously failed messages
        console.log("\n[Cron] Checking for failed messages to retry...");
        const retryResults = await retryFailedMessages(gmail, 3);
        results.push(...retryResults);

        // Step 6: Report summary
        const duration = Date.now() - startTime;
        const successful = results.filter((r) => r.success).length;
        const failed = results.filter((r) => !r.success).length;

        console.log("\n========================================");
        console.log("  Run Complete");
        console.log("========================================");
        console.log(`  Processed: ${results.length}`);
        console.log(`  Successful: ${successful}`);
        console.log(`  Failed: ${failed}`);
        console.log(`  Duration: ${(duration / 1000).toFixed(1)}s`);
        console.log("========================================\n");

        // Send success notification if configured
        if (results.length > 0) {
            await notifySuccess({
                processed: results.length,
                successful,
                failed,
                duration,
            });
        }
    } catch (error) {
        console.error("\n[Cron] Fatal error:", error);
        throw error;
    } finally {
        // Always release the lock
        await releaseLock(LOCK_NAME);
    }
}

// Run the main function
main()
    .then(() => {
        process.exit(0);
    })
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
