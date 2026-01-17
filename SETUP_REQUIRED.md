# ⚠️ SETUP REQUIRED - NOT ACTIVE

This email relay system is **not yet active**. Complete the setup below before running in production.

---

## Quick Resume Checklist

### 1. Google Cloud OAuth Setup (Required)
- [ ] Go to [Google Cloud Console](https://console.cloud.google.com/)
- [ ] Create a project (or use existing)
- [ ] Enable the **Gmail API**
- [ ] Create **OAuth 2.0 credentials** (Desktop App type)
- [ ] Copy `Client ID` and `Client Secret` to `.env`
- [ ] Run: `npx tsx src/cli/auth-gmail.ts --url`
- [ ] Visit the URL, authorize, copy the code
- [ ] Run: `npx tsx src/cli/auth-gmail.ts --code <your_code>`
- [ ] Copy the tokens to `.env`

### 2. Configure Your Team
- [ ] Edit `src/cli/seed-agents.ts` with your actual agents
- [ ] Run: `npm run seed`

### 3. Customize Email Template
- [ ] Edit `src/lib/gmail/send.ts` → `generateLeadReplyText()` and `generateLeadReplyHtml()`
- [ ] Update sender name/email in `.env`

### 4. Test Locally
- [ ] Send a test email to your Gmail inbox
- [ ] Run: `npm run cron`
- [ ] Check: `npx tsx src/cli/status.ts`

### 5. Set Up Production Cron
- [ ] Choose cron method (system cron, Vercel, Railway, etc.)
- [ ] Configure to run `npm run cron` every minute

### 6. Optional: Alerting
- [ ] Add Slack webhook URL to `.env`
- [ ] Or add Discord webhook URL to `.env`

---

## When Ready to Activate

1. Complete all checkboxes above
2. Delete this file
3. Update README.md to remove "NOT ACTIVE" status

---

*Last updated: January 17, 2026*
