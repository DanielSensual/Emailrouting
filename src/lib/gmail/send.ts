import MailComposer from "nodemailer/lib/mail-composer";
import type { gmail_v1 } from "googleapis";
import { bufferToBase64Url } from "./base64url.js";

export interface SendEmailParams {
    gmail: gmail_v1.Gmail;
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    inReplyTo?: string; // For threading
    references?: string; // For threading
}

/**
 * Send an email via Gmail API using MailComposer for proper RFC822 formatting
 * 
 * This approach:
 * - Avoids SMTP configuration
 * - Handles encoding correctly (emojis, international characters)
 * - Uses the same OAuth token as reading
 * - Creates proper email threads when replying
 */
export async function sendEmail(params: SendEmailParams): Promise<string> {
    const {
        gmail,
        to,
        from,
        subject,
        text,
        html,
        replyTo,
        inReplyTo,
        references,
    } = params;

    // Build the email using nodemailer's MailComposer
    const mailOptions: ConstructorParameters<typeof MailComposer>[0] = {
        to,
        from,
        subject,
        text,
        html,
        replyTo,
        headers: {},
    };

    // Add threading headers if replying to a message
    if (inReplyTo) {
        mailOptions.headers = {
            ...mailOptions.headers,
            "In-Reply-To": inReplyTo,
            References: references || inReplyTo,
        };
    }

    const mail = new MailComposer(mailOptions);

    // Compile to RFC822 format
    const msgBuf = await mail.compile().build();

    // Encode for Gmail API
    const raw = bufferToBase64Url(msgBuf);

    // Send via Gmail API
    const res = await gmail.users.messages.send({
        userId: "me",
        requestBody: { raw },
    });

    console.log(`[Gmail Send] Email sent to ${to}, messageId: ${res.data.id}`);

    return res.data.id ?? "";
}

/**
 * Send a lead reply email with agent booking information
 */
export async function sendLeadReply(params: {
    gmail: gmail_v1.Gmail;
    to: string;
    from: string;
    subject: string;
    text?: string;
    html?: string;
    replyTo?: string;
    agentName?: string;
    bookingUrl?: string;
}): Promise<string> {
    const {
        gmail,
        to,
        from,
        subject,
        replyTo,
        agentName,
        bookingUrl,
    } = params;

    // Generate email content if not provided
    let text = params.text;
    let html = params.html;

    if (!text && !html && agentName && bookingUrl) {
        text = generateLeadReplyText(agentName, bookingUrl);
        html = generateLeadReplyHtml(agentName, bookingUrl);
    }

    return sendEmail({
        gmail,
        to,
        from,
        subject,
        text,
        html,
        replyTo,
    });
}

function generateLeadReplyText(agentName: string, bookingUrl: string): string {
    return `Thanks for reaching out!

Your assigned agent is ${agentName}.

You can book a time to connect here:
${bookingUrl}

We'll be in touch soon!
`;
}

function generateLeadReplyHtml(agentName: string, bookingUrl: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 16px; }
    .button:hover { background: #0056b3; }
  </style>
</head>
<body>
  <div class="container">
    <p>Thanks for reaching out!</p>
    <p>Your assigned agent is <strong>${agentName}</strong>.</p>
    <p>
      <a href="${bookingUrl}" class="button">Book a Time to Connect</a>
    </p>
    <p>We'll be in touch soon!</p>
  </div>
</body>
</html>
`;
}
