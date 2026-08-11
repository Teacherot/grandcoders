# MoMo SMS Forwarder Configuration

The `momoWebhook` function receives forwarded Mobile Money SMS and auto-credits
agent wallets. This file is the setup guide for **any** SMS forwarder app
(SMS Forwarder, Tasker, MacroDroid, SMS Gateway, etc.).

---

## 1. Webhook URL

Find the function URL in the Base44 dashboard:
**Code → Functions → `momoWebhook` → Endpoint URL**

It looks like:
```
https://apps.base44.com/api/functions/momoWebhook
```

Append nothing to the URL itself unless you use the `?token=` option below.

---

## 2. Authentication (REQUIRED)

The webhook rejects any request that does not carry your `MOMO_WEBHOOK_SECRET`.
Pick ONE of these methods (whichever your forwarder supports):

### Option A — Custom header (recommended)
```
Header name:  x-webhook-secret
Header value: <MOMO_WEBHOOK_SECRET>
```

### Option B — Authorization header
```
Header name:  Authorization
Header value: Bearer <MOMO_WEBHOOK_SECRET>
```

### Option C — Query string (if your forwarder can't send headers)
```
https://apps.base44.com/api/functions/momoWebhook?token=<MOMO_WEBHOOK_SECRET>
```

> Keep the secret private. Treat it like a password — anyone who has it can
> post fake MoMo notifications and credit agent wallets.

---

## 3. Request format

The webhook accepts JSON, form-urlencoded, or plain text. **JSON is preferred.**

### JSON payload
```
Content-Type: application/json

{
  "message": "You have received GHS 50.00 from 0244123456. Transaction ID 1234567890. Reference: 0244123456.",
  "sender": "0244123456",
  "amount": 50.00,
  "transaction_id": "1234567890",
  "reference": "0244123456",
  "network": "MTN"
}
```

Only `message` (the raw SMS text) is strictly required — the webhook parses
amount, sender, transaction ID, and reference out of it. Providing the
structured fields too is a good fallback in case parsing fails.

### Form-urlencoded payload
```
Content-Type: application/x-www-form-urlencoded

message=You have received GHS 50.00 from 0244123456. Transaction ID 1234567890. Reference: 0244123456.&sender=0244123456&network=MTN
```

### Plain text payload (the raw SMS only)
```
Content-Type: text/plain

You have received GHS 50.00 from 0244123456. Transaction ID 1234567890. Reference: 0244123456.
```

---

## 4. What the SMS must contain

For auto-credit to work, the forwarded SMS (or the structured `message` field)
must include:

- **Amount** — e.g. `GHS 50.00`, `GH₵ 50`, `GHC 50`
- **Transaction ID** — a 6–12 digit code, or labelled `Transaction ID: …`
- **Sender number** — Ghanaian format `0244123456` or `233244123456`
- **Reference** *(important)* — the agent types their **registered phone number**
  as the payment reference so the webhook can match and credit them
  automatically. Without a matching reference or sender, the transaction is
  stored as `pending` for manual claim.

---

## 5. Forwarder app settings (example: "SMS Forwarder" / Tasker)

| Setting            | Value                                              |
|--------------------|----------------------------------------------------|
| Trigger            | SMS received from Mobile Money sender (MTN/Telecel/AirtelTigo) |
| Forward to         | Webhook URL (section 1)                            |
| HTTP method        | POST                                               |
| Content-Type       | `application/json`                                 |
| Body template      | `{"message":"{{sms_body}}","sender":"{{sender}}"}` |
| Extra header       | `x-webhook-secret: <MOMO_WEBHOOK_SECRET>`          |

For Tasker, use the **HTTP Request** action with the same values.

---

## 6. Testing

After configuring, send a test MoMo payment and check the response. A success
looks like:
```json
{ "ok": true, "auto_claimed": true, "agent": "Kwame Mensah", "new_balance": 150 }
```
If the agent isn't matched:
```json
{ "ok": true, "id": "...", "auto_claimed": false }
```
The transaction is stored as `pending` and the agent can claim it from their
dashboard using the transaction ID.

If you see `401 Unauthorized`, the secret is missing or wrong — check section 2.