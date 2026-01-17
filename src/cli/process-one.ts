#!/usr/bin/env npx tsx
/**
 * Process a single message by ID
 * 
 * Useful for:
 * - Debugging specific message parsing issues
 * - Manually retrying a failed message
 * - Testing the pipeline with a known message
 * 
 * Usage:
 *   npx tsx src/cli/process-one.ts <messageId>
 *   npm run process -- <messageId>
 */

import "dotenv/config";
import { getGmailClient } from "../lib/gmail/index.js";
import { processMessage } from "../lib/worker/index.js";

async function main() {
    const messageId = process.argv[2];

    if (!messageId) {
        console.error("Usage: npx tsx src/cli/process-one.ts <messageId>");
        console.error("");
        console.error("You can find message IDs by:");
        console.error("  1. Looking at failed messages in the database");
        console.error("  2. Using the Gmail API to list messages");
        console.error("  3. Checking Gmail message URLs (last part of the URL)");
        process.exit(1);
    }

    console.log("\n========================================");
    console.log("  Process Single Message");
    console.log(`  Message ID: ${messageId}`);
    console.log("========================================\n");

    try {
        const gmail = getGmailClient();
        console.log("[Process] Gmail client authenticated\n");

        const result = await processMessage(gmail, messageId);

        console.log("\n========================================");
        console.log("  Result");
        console.log("========================================");

        if (result.success) {
            console.log("  Status: ✓ SUCCESS");
            console.log(`  Lead ID: ${result.leadId}`);
            console.log(`  Assigned Agent: ${result.agentName}`);
        } else {
            console.log("  Status: ✗ FAILED");
            console.log(`  Error: ${result.error}`);
        }

        console.log("========================================\n");
    } catch (error) {
        console.error("Fatal error:", error);
        process.exit(1);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
