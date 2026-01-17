#!/usr/bin/env npx tsx
/**
 * Generate OAuth URL and exchange authorization code for tokens
 * 
 * Run this once to set up Gmail API authentication:
 * 
 * 1. Run with --url to get the authorization URL
 * 2. Visit the URL and authorize the application
 * 3. Copy the authorization code from the redirect
 * 4. Run with --code <code> to exchange for tokens
 * 5. Copy the tokens to your .env file
 * 
 * Usage:
 *   npx tsx src/cli/auth-gmail.ts --url
 *   npx tsx src/cli/auth-gmail.ts --code <authorization_code>
 */

import "dotenv/config";
import { getAuthUrl, exchangeCodeForTokens } from "../lib/gmail/auth.js";

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    console.log("\n========================================");
    console.log("  Gmail OAuth Setup");
    console.log("========================================\n");

    if (command === "--url") {
        // Generate authorization URL
        if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
            console.error("Error: GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set in .env");
            console.error("");
            console.error("Get these from Google Cloud Console:");
            console.error("  1. Go to https://console.cloud.google.com/");
            console.error("  2. Create a project or select existing one");
            console.error("  3. Enable the Gmail API");
            console.error("  4. Create OAuth 2.0 credentials (Desktop App)");
            console.error("  5. Copy Client ID and Client Secret to .env");
            process.exit(1);
        }

        const url = getAuthUrl();

        console.log("Step 1: Visit this URL to authorize the application:\n");
        console.log(url);
        console.log("");
        console.log("Step 2: After authorizing, you'll be redirected.");
        console.log("        Copy the 'code' parameter from the URL.");
        console.log("");
        console.log("Step 3: Run this command with the code:");
        console.log("        npx tsx src/cli/auth-gmail.ts --code <your_code>");
        console.log("");
    } else if (command === "--code") {
        const code = args[1];

        if (!code) {
            console.error("Usage: npx tsx src/cli/auth-gmail.ts --code <authorization_code>");
            process.exit(1);
        }

        console.log("Exchanging authorization code for tokens...\n");

        try {
            await exchangeCodeForTokens(code);
            console.log("Copy the tokens above to your .env file and restart the application.");
        } catch (error: any) {
            console.error("Error exchanging code:", error.message);
            console.error("");
            console.error("Common issues:");
            console.error("  - Code has expired (they're only valid for a few minutes)");
            console.error("  - Code was already used");
            console.error("  - Client ID/Secret don't match");
            process.exit(1);
        }
    } else {
        console.log("Gmail OAuth Setup Helper");
        console.log("");
        console.log("Commands:");
        console.log("  --url         Generate the OAuth authorization URL");
        console.log("  --code <code> Exchange an authorization code for tokens");
        console.log("");
        console.log("Example workflow:");
        console.log("  1. npx tsx src/cli/auth-gmail.ts --url");
        console.log("  2. Visit the URL and authorize");
        console.log("  3. npx tsx src/cli/auth-gmail.ts --code 4/abc123...");
        console.log("  4. Copy tokens to .env");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
