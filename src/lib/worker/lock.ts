import { prisma } from "../db.js";

const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_LOCK_NAME = "email_processor";

/**
 * Acquire a distributed lock for the worker process
 * 
 * This prevents multiple cron jobs from running simultaneously.
 * Uses a database row with an expiration timestamp.
 * 
 * @param lockName - Name of the lock (default: "email_processor")
 * @param workerId - Identifier for this worker instance
 * @returns true if lock was acquired, false if another worker holds it
 */
export async function acquireLock(
    lockName: string = DEFAULT_LOCK_NAME,
    workerId: string = `worker-${process.pid}-${Date.now()}`
): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + LOCK_TTL_MS);

    try {
        // Check if lock exists and is still valid
        const existingLock = await prisma.systemLock.findUnique({
            where: { name: lockName },
        });

        if (existingLock && existingLock.expiresAt > now) {
            // Lock is held by another worker
            console.log(
                `[Lock] Lock "${lockName}" held by ${existingLock.lockedBy}, expires at ${existingLock.expiresAt}`
            );
            return false;
        }

        // Acquire or refresh the lock
        await prisma.systemLock.upsert({
            where: { name: lockName },
            update: {
                lockedBy: workerId,
                expiresAt,
            },
            create: {
                name: lockName,
                lockedBy: workerId,
                expiresAt,
            },
        });

        console.log(`[Lock] Acquired lock "${lockName}" as ${workerId}`);
        return true;
    } catch (error) {
        console.error(`[Lock] Error acquiring lock:`, error);
        return false;
    }
}

/**
 * Release the lock after processing completes
 */
export async function releaseLock(
    lockName: string = DEFAULT_LOCK_NAME
): Promise<void> {
    try {
        await prisma.systemLock.update({
            where: { name: lockName },
            data: {
                expiresAt: new Date(0), // Set to past to effectively release
                lockedBy: null,
            },
        });
        console.log(`[Lock] Released lock "${lockName}"`);
    } catch (error) {
        // Lock might not exist - that's okay
        console.log(`[Lock] Could not release lock (may not exist):`, error);
    }
}

/**
 * Check if the lock is currently held
 */
export async function isLocked(
    lockName: string = DEFAULT_LOCK_NAME
): Promise<boolean> {
    const lock = await prisma.systemLock.findUnique({
        where: { name: lockName },
    });

    return lock !== null && lock.expiresAt > new Date();
}

/**
 * Extend the lock TTL (call periodically during long processing)
 */
export async function extendLock(
    lockName: string = DEFAULT_LOCK_NAME,
    workerId: string
): Promise<boolean> {
    try {
        const lock = await prisma.systemLock.findUnique({
            where: { name: lockName },
        });

        // Only extend if we own the lock
        if (lock?.lockedBy !== workerId) {
            return false;
        }

        await prisma.systemLock.update({
            where: { name: lockName },
            data: {
                expiresAt: new Date(Date.now() + LOCK_TTL_MS),
            },
        });

        return true;
    } catch {
        return false;
    }
}
