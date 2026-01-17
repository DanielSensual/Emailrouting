const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export interface FailureNotification {
    messageId: string;
    error: string;
    attempts: number;
}

/**
 * Send a failure notification to configured webhooks
 * 
 * Supports both Slack and Discord webhooks.
 * Silently skips if no webhooks are configured.
 */
export async function notifyFailure(payload: FailureNotification): Promise<void> {
    const { messageId, error, attempts } = payload;

    // Truncate error to avoid huge payloads
    const truncatedError = error.length > 500 ? error.slice(0, 500) + "..." : error;

    const timestamp = new Date().toISOString();

    // Send to Slack if configured
    if (SLACK_WEBHOOK_URL) {
        await sendSlackNotification({
            messageId,
            error: truncatedError,
            attempts,
            timestamp,
        });
    }

    // Send to Discord if configured
    if (DISCORD_WEBHOOK_URL) {
        await sendDiscordNotification({
            messageId,
            error: truncatedError,
            attempts,
            timestamp,
        });
    }

    if (!SLACK_WEBHOOK_URL && !DISCORD_WEBHOOK_URL) {
        console.log("[Alert] No webhook URLs configured, skipping notification");
    }
}

async function sendSlackNotification(payload: {
    messageId: string;
    error: string;
    attempts: number;
    timestamp: string;
}): Promise<void> {
    if (!SLACK_WEBHOOK_URL) return;

    try {
        const slackPayload = {
            blocks: [
                {
                    type: "header",
                    text: {
                        type: "plain_text",
                        text: "🚨 Email Processing Failed",
                        emoji: true,
                    },
                },
                {
                    type: "section",
                    fields: [
                        {
                            type: "mrkdwn",
                            text: `*Message ID:*\n\`${payload.messageId}\``,
                        },
                        {
                            type: "mrkdwn",
                            text: `*Attempts:*\n${payload.attempts}`,
                        },
                    ],
                },
                {
                    type: "section",
                    text: {
                        type: "mrkdwn",
                        text: `*Error:*\n\`\`\`${payload.error}\`\`\``,
                    },
                },
                {
                    type: "context",
                    elements: [
                        {
                            type: "mrkdwn",
                            text: `Timestamp: ${payload.timestamp}`,
                        },
                    ],
                },
            ],
        };

        const response = await fetch(SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(slackPayload),
        });

        if (!response.ok) {
            console.error(`[Alert] Slack webhook failed: ${response.status}`);
        } else {
            console.log("[Alert] Slack notification sent");
        }
    } catch (error) {
        console.error("[Alert] Failed to send Slack notification:", error);
    }
}

async function sendDiscordNotification(payload: {
    messageId: string;
    error: string;
    attempts: number;
    timestamp: string;
}): Promise<void> {
    if (!DISCORD_WEBHOOK_URL) return;

    try {
        const discordPayload = {
            embeds: [
                {
                    title: "🚨 Email Processing Failed",
                    color: 0xff0000, // Red
                    fields: [
                        {
                            name: "Message ID",
                            value: `\`${payload.messageId}\``,
                            inline: true,
                        },
                        {
                            name: "Attempts",
                            value: String(payload.attempts),
                            inline: true,
                        },
                        {
                            name: "Error",
                            value: `\`\`\`${payload.error}\`\`\``,
                        },
                    ],
                    timestamp: payload.timestamp,
                },
            ],
        };

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(discordPayload),
        });

        if (!response.ok) {
            console.error(`[Alert] Discord webhook failed: ${response.status}`);
        } else {
            console.log("[Alert] Discord notification sent");
        }
    } catch (error) {
        console.error("[Alert] Failed to send Discord notification:", error);
    }
}

/**
 * Send a success summary notification
 */
export async function notifySuccess(summary: {
    processed: number;
    successful: number;
    failed: number;
    duration: number;
}): Promise<void> {
    const { processed, successful, failed, duration } = summary;

    if (!SLACK_WEBHOOK_URL && !DISCORD_WEBHOOK_URL) return;

    const message = `✅ Email Relay Run Complete\n• Processed: ${processed}\n• Successful: ${successful}\n• Failed: ${failed}\n• Duration: ${(duration / 1000).toFixed(1)}s`;

    if (SLACK_WEBHOOK_URL) {
        await fetch(SLACK_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: message }),
        }).catch(console.error);
    }

    if (DISCORD_WEBHOOK_URL) {
        await fetch(DISCORD_WEBHOOK_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: message }),
        }).catch(console.error);
    }
}
