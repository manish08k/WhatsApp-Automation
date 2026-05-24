# WhatsApp-Automation — AutoFlow

A Node.js automation engine for **WhatsApp Business API** and **Instagram Graph API**. Run flows, set triggers, send messages, and manage templates via a REST API + web UI.

---

## Prerequisites

- Node.js ≥ 18
- A [Meta Developer App](https://developers.facebook.com/) with:
  - WhatsApp Business API access
  - Instagram Graph API access (optional)
- A public HTTPS URL for webhooks (use [ngrok](https://ngrok.com/) locally)

---

## Setup

```bash
# 1. Clone
git clone https://github.com/manish08k/WhatsApp-Automation.git
cd WhatsApp-Automation/autoflow

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env
```

Edit `.env`:

```env
PORT=3000

# WhatsApp Business API
WA_PHONE_NUMBER_ID=your_phone_number_id
WA_ACCESS_TOKEN=your_permanent_access_token
WA_BUSINESS_ACCOUNT_ID=your_waba_id
WA_VERIFY_TOKEN=autoflow_verify_secret
WA_API_VERSION=v19.0

# Instagram Graph API (optional)
IG_USER_ID=your_ig_business_account_id
IG_ACCESS_TOKEN=your_page_access_token
IG_APP_ID=your_facebook_app_id
IG_APP_SECRET=your_facebook_app_secret
IG_VERIFY_TOKEN=autoflow_ig_secret

# App
NODE_ENV=development
LOG_LEVEL=info
```

---

## Run

```bash
node index.js
```

Server starts on `http://localhost:3000`

---

## Web UI

Open `http://localhost:3000` in your browser to access the automation dashboard.

---

## Webhook Setup (Meta Developer Console)

| Channel | Webhook URL |
|---|---|
| WhatsApp | `https://your-domain.com/webhook/whatsapp` |
| Instagram | `https://your-domain.com/webhook/instagram` |

Use the `WA_VERIFY_TOKEN` / `IG_VERIFY_TOKEN` from `.env` as the verify token in Meta console.

For local dev:
```bash
ngrok http 3000
# Use the https ngrok URL as your webhook base
```

---

## API Reference

### Health
```
GET /health
```

### Flows
```
GET    /api/flows
POST   /api/flows          body: { id, name, channel, steps[] }
PATCH  /api/flows/:id
DELETE /api/flows/:id
POST   /api/flows/:id/run  body: { context: {} }
```

### Triggers
```
GET    /api/triggers
POST   /api/triggers       body: { id, name, channel, event, condition, flowId, replyTemplate }
PATCH  /api/triggers/:id
DELETE /api/triggers/:id
```

### Templates
```
GET    /api/templates
PUT    /api/templates/:name   body: { body: "template text" }
DELETE /api/templates/:name
```

### Send Messages
```
POST /api/send/whatsapp
  body: { to, type, text }             # type: text (default)
  body: { to, type: "template", templateName, lang }
  body: { to, type: "image", imageUrl, caption }
  body: { to, type: "buttons", body, buttons: [{ id, title }] }

POST /api/send/instagram/dm
  body: { to, text }
```

### Test / Simulate
```
POST /api/test/whatsapp     body: { from, text }
POST /api/test/instagram    body: { event, senderId, text }
```

### Logs & Stats
```
GET    /api/logs?channel=whatsapp&level=info&limit=50
DELETE /api/logs
GET    /api/stats
```

---

## Project Structure

```
autoflow/
├── index.js                  # Entry point / Express app
├── package.json
├── .env.example
├── public/
│   └── automation-platform.html   # Web UI
└── src/
    ├── store.js              # In-memory data store
    ├── logger.js             # Winston logger
    ├── middleware/
    │   └── rateLimiter.js
    ├── routes/
    │   ├── api.js            # REST API
    │   ├── whatsapp.js       # WhatsApp webhook
    │   └── instagram.js      # Instagram webhook
    ├── services/
    │   ├── whatsapp.js       # WhatsApp API calls
    │   └── instagram.js      # Instagram API calls
    └── engine/
        ├── flowRunner.js     # Flow execution
        ├── triggerMatcher.js # Trigger evaluation
        └── processor.js      # Incoming message processor
```

---

## Notes

- Data is stored **in-memory** only — restarts clear all flows, triggers, and logs.
- WhatsApp messaging is subject to [Meta's messaging policies](https://developers.facebook.com/docs/whatsapp/overview/getting-opt-in).
- Rate limiting is applied to all webhook and API endpoints.
