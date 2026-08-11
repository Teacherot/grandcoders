import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { secrets } from 'base44:runtime';
import { findAgentByPhone, creditAgentWallet, normalizePhone } from '../../shared/momo.ts';

// Receives a forwarded Mobile Money SMS. If the sender's phone number matches
// a registered agent, the wallet is auto-credited instantly; otherwise the
// transaction stays pending for manual claim via claimMomoTopup.
// Called without user auth (external SMS forwarder) — uses the service role.

function parseMomoSms(text) {
  if (!text) return {};
  const t = String(text);
  const amountMatch = t.match(/(?:GHS|GH₵|GHC|GH)\s*([\d.,]+)/i);
  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/[,\s]/g, '')) : null;
  const senderMatch =
    t.match(/(?:from|sender|f)\s*[:\-]?\s*((?:0|233)\d{6,})/i) ||
    t.match(/\b(0\d{9})\b/) ||
    t.match(/\b(233\d{9})\b/);
  const sender_number = senderMatch ? senderMatch[1] : null;
  const txnMatch =
    t.match(/(?:transaction\s*id|txn\s*id)\s*[:\-]?\s*([A-Z0-9]{4,})/i) ||
    t.match(/\b(\d{6,12})\b/);
  const transaction_id = txnMatch ? txnMatch[1] : null;
  // Reference the sender typed — agents are told to use their registered
  // phone number here so the webhook can auto-match and credit their wallet.
  const refMatch =
    t.match(/(?:reference|ref|reason|note|remark)\s*[:\-]?\s*((?:0|233)\d{6,})/i);
  const reference = refMatch ? refMatch[1] : null;
  // Recipient (the wallet that received the money). Excludes "from/sender" so
  // we don't mistake the sender for the recipient. Used to confirm the payment
  // landed in the admin's wallet before auto-crediting an agent.
  const recipMatch =
    t.match(/(?:to|recipient|received\s+on|wallet|account|destination)\s*[:\-]?\s*((?:0|233)\d{6,})/i);
  const recipient_number = recipMatch ? recipMatch[1] : null;
  return { amount, sender_number, transaction_id, reference, recipient_number };
}

function timingSafeEqual(a: string, b: string): boolean {
  const sa = String(a), sb = String(b);
  if (sa.length !== sb.length) return false;
  let diff = 0;
  for (let i = 0; i < sa.length; i++) diff |= sa.charCodeAt(i) ^ sb.charCodeAt(i);
  return diff === 0;
}

export default async function(req) {
  try {
    // Authenticate the SMS forwarder with a shared secret. Without this,
    // anyone could POST a fake MoMo notification and inflate agent wallets.
    const expectedSecret = secrets.get('MOMO_WEBHOOK_SECRET');
    if (!expectedSecret) {
      return Response.json({ error: 'Webhook secret not configured' }, { status: 500 });
    }
    let providedSecret =
      req.headers.get('x-webhook-secret') ||
      req.headers.get('x-momo-secret') ||
      (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim() ||
      '';
    if (!providedSecret) {
      try { providedSecret = new URL(req.url).searchParams.get('token') || ''; } catch { providedSecret = ''; }
    }
    if (!providedSecret || !timingSafeEqual(providedSecret, expectedSecret)) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const base44 = createClientFromRequest(req);

    // Read the raw body once so any SMS forwarder format works, and keep the
    // original text so we can store it for review when parsing fails.
    let rawBody = '';
    try { rawBody = await req.text() || ''; } catch { rawBody = ''; }
    let body: any = {};
    const ctype = (req.headers.get('content-type') || '').toLowerCase();
    const trimmed = rawBody.trim();
    if (ctype.includes('application/x-www-form-urlencoded') && trimmed && !trimmed.startsWith('{')) {
      try {
        const params = new URLSearchParams(rawBody);
        for (const [k, v] of params.entries()) body[k] = v;
      } catch { body = { message: rawBody }; }
    } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try { body = JSON.parse(trimmed); } catch { body = { message: rawBody }; }
    } else if (trimmed) {
      body = { message: rawBody };
    }

    // Normalise common SMS-forwarder field names.
    const pick = (...keys: string[]) => {
      for (const k of keys) {
        const v = body[k];
        if (v !== undefined && v !== null && v !== '') return v;
      }
      return undefined;
    };

    let transaction_id = pick('transaction_id', 'txn_id', 'transactionId', 'txnId', 'id');
    let amount = pick('amount', 'value', 'amt', 'Amount');
    let sender_number = pick('sender_number', 'sender', 'from', 'from_number', 'msisdn', 'phone', 'senderNumber');
    let recipient_number = pick('recipient_number', 'recipient', 'to', 'to_number', 'wallet_number', 'account_number', 'account', 'destination', 'recipientNumber');
    let reference = pick('reference', 'ref', 'reason', 'note', 'remark', 'payment_reference');
    let message = pick('message', 'text', 'body', 'sms', 'content', 'message_body', 'sms_body', 'sms_text', 'full_text', 'raw_text', 'key', 'msg');
    let network = pick('network', 'operator', 'carrier');

    // Fall back to parsing the raw SMS if structured fields are missing.
    if (message) {
      const parsed = parseMomoSms(message);
      transaction_id = transaction_id || parsed.transaction_id;
      if (amount == null) amount = parsed.amount;
      sender_number = sender_number || parsed.sender_number;
      recipient_number = recipient_number || parsed.recipient_number;
      reference = reference || parsed.reference;
    }

    // Diagnostic mode: if we couldn't parse the transaction id or amount,
    // still store the raw payload as a pending record so we can see exactly
    // what the forwarder sent and adjust the parser — instead of returning
    // a 400 that drops the request silently.
    const parsedOk = !!(transaction_id && amount != null && !isNaN(Number(amount)));
    if (!parsedOk) {
      const fallbackId = transaction_id
        ? String(transaction_id)
        : `fwd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      try {
        await base44.asServiceRole.entities.MomoTransaction.create({
          transaction_id: fallbackId,
          amount: amount != null && !isNaN(Number(amount)) ? Number(amount) : 0,
          sender_number: sender_number || '',
          raw_message: message || rawBody || '',
          network: network || '',
          status: 'pending',
        });
      } catch { /* ignore write failure */ }
      return Response.json({
        ok: false,
        stored_for_review: true,
        transaction_id: fallbackId,
        note: 'Payload stored for parser review — amount or transaction_id could not be parsed',
      });
    }

    // Idempotency: skip if we already recorded this transaction ID.
    const existing = await base44.asServiceRole.entities.MomoTransaction
      .filter({ transaction_id: String(transaction_id) })
      .catch(() => []);
    if (existing && existing.length > 0) {
      return Response.json({ ok: true, duplicate: true, id: existing[0].id });
    }

    // Recipient guard: only auto-credit when the payment landed in the admin's
    // wallet. A misconfigured forwarder capturing another person's inbox would
    // otherwise inflate an agent's wallet for a payment that wasn't to us. If
    // the admin number isn't configured or the recipient can't be determined
    // from the SMS, fall back to pending (never auto-credit).
    const adminNumber = secrets.get('ADMIN_MOMO_NUMBER');
    const recipientOk = !!adminNumber && !!recipient_number &&
      normalizePhone(recipient_number) === normalizePhone(adminNumber);

    let autoClaimed = false;
    let agent = null;
    if (recipientOk) {
      // Auto-claim: try the payment reference first (the agent types their
      // registered number there), then the sender number. If either matches a
      // registered agent, credit their wallet immediately.
      const matchBy = [reference, sender_number].filter(Boolean);
      for (const candidate of matchBy) {
        try {
          agent = await findAgentByPhone(base44, candidate);
          if (agent) break;
        } catch { /* ignore lookup failure, falls back to pending */ }
      }
    }

    if (agent) {
      const newBalance = await creditAgentWallet(base44, agent, amount, transaction_id);
      await base44.asServiceRole.entities.MomoTransaction.create({
        transaction_id: String(transaction_id),
        amount: Number(amount),
        sender_number: sender_number || '',
        raw_message: message || '',
        network: network || '',
        status: 'claimed',
        agent_id: agent.id,
        agent_name: agent.full_name,
      });
      autoClaimed = true;
      return Response.json({ ok: true, auto_claimed: true, agent: agent.full_name, new_balance: newBalance });
    }

    const created = await base44.asServiceRole.entities.MomoTransaction.create({
      transaction_id: String(transaction_id),
      amount: Number(amount),
      sender_number: sender_number || '',
      raw_message: message || '',
      network: network || '',
      status: 'pending',
    });

    return Response.json({ ok: true, id: created.id, auto_claimed: autoClaimed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}