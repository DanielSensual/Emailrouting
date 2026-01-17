#!/usr/bin/env npx tsx
/**
 * Seed agents into the database
 * 
 * Run this once to add your team members who will receive leads.
 * Edit the AGENTS array below with your actual team data.
 * 
 * Usage:
 *   npx tsx src/cli/seed-agents.ts
 *   npm run seed
 */

import "dotenv/config";
import { prisma } from "../lib/db.js";

// ============================================
// EDIT THIS ARRAY WITH YOUR TEAM MEMBERS
// ============================================
const AGENTS = [
    {
        name: "Sarah Johnson",
        email: "sarah@example.com",
        phone: "(555) 123-4567",
        bookingUrl: "https://calendly.com/sarah-johnson",
    },
    {
        name: "Mike Chen",
        email: "mike@example.com",
        phone: "(555) 234-5678",
        bookingUrl: "https://calendly.com/mike-chen",
    },
    {
        name: "Emily Davis",
        email: "emily@example.com",
        phone: "(555) 345-6789",
        bookingUrl: "https://calendly.com/emily-davis",
    },
];

async function main() {
    console.log("\n========================================");
    console.log("  Seed Agents");
    console.log("========================================\n");

    for (const agent of AGENTS) {
        const existing = await prisma.agent.findUnique({
            where: { email: agent.email },
        });

        if (existing) {
            console.log(`  [Skip] ${agent.name} (${agent.email}) - already exists`);
            continue;
        }

        await prisma.agent.create({
            data: {
                name: agent.name,
                email: agent.email,
                phone: agent.phone,
                bookingUrl: agent.bookingUrl,
                isActive: true,
            },
        });

        console.log(`  [Created] ${agent.name} (${agent.email})`);
    }

    // Show current agents
    const allAgents = await prisma.agent.findMany({
        orderBy: { name: "asc" },
    });

    console.log("\n========================================");
    console.log("  Current Agents");
    console.log("========================================");

    for (const agent of allAgents) {
        const status = agent.isActive ? "✓" : "✗";
        console.log(`  ${status} ${agent.name} <${agent.email}>`);
        console.log(`    Phone: ${agent.phone || "N/A"}`);
        console.log(`    Booking: ${agent.bookingUrl || "N/A"}`);
        console.log(`    Assignments: ${agent.assignedCount}`);
        console.log("");
    }

    console.log(`Total: ${allAgents.length} agents\n`);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("Error seeding agents:", error);
        process.exit(1);
    });
