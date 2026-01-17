# Email Relay System

> ⚠️ **STATUS: NOT ACTIVE** - Setup required before use. See [SETUP_REQUIRED.md](./SETUP_REQUIRED.md)

## Features

- **Gmail Integration**: Uses Gmail API with OAuth2 for reading and sending emails
- **Smart Parsing**: Chain-of-responsibility pattern supporting Zillow, Realtor.com, Facebook Lead Ads, and generic emails
- **Dead-Letter Queue**: Failed messages are tracked and can be retried without data loss
- **Agent Assignment**: Round-robin distribution with fair assignment tracking
- **Concurrency Safety**: Database-based locks prevent duplicate processing
- **Alerting**: Slack/Discord webhooks for failure notifications

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

### 3. Configure Google Cloud

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project and enable the Gmail API
3. Create OAuth 2.0 credentials (Desktop App type)
4. Copy Client ID and Client Secret to `.env`

### 4. Authorize Gmail Access

```bash
# Get authorization URL
npx tsx src/cli/auth-gmail.ts --url

# Visit the URL, authorize, then exchange code for tokens
npx tsx src/cli/auth-gmail.ts --code <your_code>

# Copy the tokens to .env
```

### 5. Initialize Database

```bash
npm run db:push
```

### 6. Add Your Agents

Edit `src/cli/seed-agents.ts` with your team members, then:

```bash
npm run seed
```

### 7. Run the Relay

```bash
# One-time run
npm run cron

# Watch mode (for development)
npm run dev
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `npm run cron` | Run the email processor once |
| `npm run dev` | Watch mode with auto-reload |
| `npm run process -- <id>` | Process a single message by ID |
| `npm run seed` | Seed agents into the database |
| `npx tsx src/cli/status.ts` | View processing statistics |
| `npx tsx src/cli/auth-gmail.ts` | Gmail OAuth setup helper |

## Database Commands

| Command | Description |
|---------|-------------|
| `npm run db:push` | Push schema to database |
| `npm run db:migrate` | Create migration files |
| `npm run db:studio` | Open Prisma Studio (GUI) |

## Setting Up Cron

For production, add a cron job to run the processor every minute:

```cron
* * * * * cd /path/to/email-relay && npx tsx src/cli/run-cron.ts >> /var/log/email-relay.log 2>&1
```

Or use a service like:
- **Vercel Cron**: Add to `vercel.json`
- **Railway**: Use their cron feature
- **AWS EventBridge**: Schedule Lambda invocations

## Project Structure

```
.
├── prisma/
│   └── schema.prisma       # Database schema
├── src/
│   ├── lib/
│   │   ├── db.ts           # Prisma client
│   │   ├── gmail/          # Gmail API integration
│   │   │   ├── auth.ts     # OAuth2 authentication
│   │   │   ├── base64url.ts # Encoding utilities
│   │   │   ├── extract.ts  # Email extraction
│   │   │   └── send.ts     # Email sending
│   │   ├── parser/         # Lead parsing engine
│   │   │   ├── parsers/    # Source-specific parsers
│   │   │   ├── types.ts    # Type definitions
│   │   │   └── validators.ts # Validation utilities
│   │   ├── worker/         # Message processing
│   │   │   ├── assign.ts   # Agent assignment
│   │   │   ├── lock.ts     # Concurrency locks
│   │   │   ├── poller.ts   # Inbox polling
│   │   │   └── processor.ts # Core processing logic
│   │   └── alerts/         # Alerting
│   │       ├── digest.ts   # Daily summaries
│   │       └── webhook.ts  # Slack/Discord notifications
│   └── cli/                # CLI entry points
│       ├── auth-gmail.ts   # OAuth setup
│       ├── process-one.ts  # Single message processing
│       ├── run-cron.ts     # Main cron job
│       ├── seed-agents.ts  # Agent seeding
│       └── status.ts       # Status dashboard
└── package.json
```

## Customizing Parsers

Add new lead source parsers in `src/lib/parser/parsers/`:

```typescript
import type { LeadParser } from "../types.js";

export const parseMySource: LeadParser = (text, subject) => {
  // Return null if this parser doesn't match
  if (!text.includes("MySource")) return null;
  
  // Extract and return lead data
  return {
    email: "...",
    firstName: "...",
    source: "mysource",
  };
};
```

Then add it to the parser chain in `src/lib/parser/index.ts`.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | Database connection string |
| `GOOGLE_CLIENT_ID` | Yes | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | OAuth client secret |
| `GOOGLE_REFRESH_TOKEN` | Yes | OAuth refresh token |
| `GOOGLE_ACCESS_TOKEN` | No | OAuth access token (auto-refreshes) |
| `SENDER_EMAIL` | Yes | Email address for sending replies |
| `SENDER_NAME` | No | Display name for sender |
| `GMAIL_LABEL_FILTER` | No | Only process emails with this label |
| `MAX_MESSAGES_PER_RUN` | No | Limit messages per cron run (default: 50) |
| `SLACK_WEBHOOK_URL` | No | Slack webhook for failure alerts |
| `DISCORD_WEBHOOK_URL` | No | Discord webhook for failure alerts |

## License

MIT
