import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";

// Required scopes for reading, modifying, and sending emails
const SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.modify",
    "https://www.googleapis.com/auth/gmail.send",
];

/**
 * Create an OAuth2 client with stored credentials
 */
function createOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret) {
        throw new Error(
            "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables"
        );
    }

    const oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        redirectUri
    );

    // Set stored tokens
    const accessToken = process.env.GOOGLE_ACCESS_TOKEN;
    const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

    if (!refreshToken) {
        throw new Error(
            "Missing GOOGLE_REFRESH_TOKEN. Run the OAuth consent flow first."
        );
    }

    oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken,
    });

    // Handle token refresh
    oauth2Client.on("tokens", (tokens) => {
        if (tokens.access_token) {
            console.log("[Gmail Auth] Access token refreshed");
            // In production, you'd want to persist this new token
        }
    });

    return oauth2Client;
}

/**
 * Get an authenticated Gmail API client
 */
export function getGmailClient(): gmail_v1.Gmail {
    const auth = createOAuth2Client();
    return google.gmail({ version: "v1", auth });
}

/**
 * Generate the OAuth consent URL for initial authorization
 * Run this once to get the authorization code, then exchange for tokens
 */
export function getAuthUrl(): string {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    return oauth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        prompt: "consent", // Force consent to get refresh token
    });
}

/**
 * Exchange authorization code for tokens
 * Use this after the user completes the OAuth consent flow
 */
export async function exchangeCodeForTokens(code: string) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
    );

    const { tokens } = await oauth2Client.getToken(code);

    console.log("\n=== SAVE THESE TOKENS TO YOUR .env FILE ===\n");
    console.log(`GOOGLE_ACCESS_TOKEN="${tokens.access_token}"`);
    console.log(`GOOGLE_REFRESH_TOKEN="${tokens.refresh_token}"`);
    console.log("\n============================================\n");

    return tokens;
}

export { SCOPES };
