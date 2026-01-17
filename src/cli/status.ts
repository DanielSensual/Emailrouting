#!/usr/bin/env npx tsx
/**
 * View processing statistics and diagnostics
 * 
 * Usage:
 *   npx tsx src/cli/status.ts
 */

import "dotenv/config";
import { prisma } from "../lib/db.js";
import { getProcessingStats, getAssignmentStats } from "../lib/worker/index.js";
import { getFailedMessageDigest, getDigestStats } from "../lib/alerts/index.js";

async function main() {
    console.log("\n========================================");
    console.log("  Email Relay Status");
    console.log(`  ${new Date().toISOString()}`);
    console.log("========================================\n");

    // Processing stats
    const processingStats = await getProcessingStats();
    console.log("📊 Message Processing:");
    console.log(`   Total: ${processingStats.total}`);
    console.log(`   Success: ${processingStats.success}`);
    console.log(`   Failed: ${processingStats.failed}`);
    console.log(`   In Progress: ${processingStats.processing}`);
    console.log("");

    // Last 24 hours
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const digestStats = await getDigestStats(since24h);
    console.log("📈 Last 24 Hours:");
    console.log(`   Messages Processed: ${digestStats.messages.total}`);
    console.log(`   Success Rate: ${digestStats.messages.successRate}`);
    console.log(`   New Leads: ${digestStats.leads.created}`);
    console.log("");

    // Agent assignments
    const assignmentStats = await getAssignmentStats();
    if (assignmentStats.length > 0) {
        console.log("👥 Agent Assignments:");
        for (const agent of assignmentStats) {
            console.log(`   ${agent.name}: ${agent.totalAssignments} total, ${agent.currentLeads} leads`);
        }
        console.log("");
    } else {
        console.log("⚠️  No agents configured. Run: npm run seed");
        console.log("");
    }

    // Failed messages
    const failedMessages = await getFailedMessageDigest(5);
    if (failedMessages.length > 0) {
        console.log("❌ Recent Failures:");
        for (const msg of failedMessages) {
            console.log(`   ${msg.messageId}`);
            console.log(`     Attempts: ${msg.attempts}`);
            console.log(`     Error: ${msg.error || "Unknown"}`);
            console.log("");
        }
    } else {
        console.log("✅ No failed messages!");
        console.log("");
    }

    // Recent leads
    const recentLeads = await prisma.lead.findMany({
        take: 5,
        orderBy: { createdAt: "desc" },
        include: { assignedAgent: true },
    });

    if (recentLeads.length > 0) {
        console.log("📧 Recent Leads:");
        for (const lead of recentLeads) {
            const name = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Unknown";
            const agent = lead.assignedAgent?.name || "Unassigned";
            console.log(`   ${name} <${lead.email}>`);
            console.log(`     Source: ${lead.source}, Agent: ${agent}`);
            console.log(`     Created: ${lead.createdAt.toISOString()}`);
            console.log("");
        }
    } else {
        console.log("📭 No leads yet.");
        console.log("");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error:", error);
        process.exit(1);
    });
