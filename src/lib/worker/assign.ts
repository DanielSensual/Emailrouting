import { prisma } from "../db.js";
import type { Agent } from "@prisma/client";

/**
 * Pick an agent using round-robin assignment
 * 
 * Selects the active agent with the oldest lastAssignedAt timestamp,
 * ensuring fair distribution of leads across the team.
 */
export async function pickAgentRoundRobin(): Promise<Agent> {
    // Get the active agent who was assigned longest ago
    const agent = await prisma.agent.findFirst({
        where: { isActive: true },
        orderBy: { lastAssignedAt: "asc" },
    });

    if (!agent) {
        throw new Error(
            "No active agents available for assignment. Please add agents to the database."
        );
    }

    // Update the assignment timestamp and count
    await prisma.agent.update({
        where: { id: agent.id },
        data: {
            lastAssignedAt: new Date(),
            assignedCount: { increment: 1 },
        },
    });

    console.log(
        `[Assign] Selected agent: ${agent.name} (${agent.email}), total assignments: ${agent.assignedCount + 1}`
    );

    return agent;
}

/**
 * Get agent by ID
 */
export async function getAgentById(agentId: string): Promise<Agent | null> {
    return prisma.agent.findUnique({
        where: { id: agentId },
    });
}

/**
 * Get all active agents
 */
export async function getActiveAgents(): Promise<Agent[]> {
    return prisma.agent.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
    });
}

/**
 * Get agent assignment statistics
 */
export async function getAssignmentStats() {
    const agents = await prisma.agent.findMany({
        where: { isActive: true },
        select: {
            id: true,
            name: true,
            email: true,
            assignedCount: true,
            lastAssignedAt: true,
            _count: { select: { leads: true } },
        },
        orderBy: { assignedCount: "desc" },
    });

    return agents.map((agent) => ({
        name: agent.name,
        email: agent.email,
        totalAssignments: agent.assignedCount,
        currentLeads: agent._count.leads,
        lastAssigned: agent.lastAssignedAt,
    }));
}
