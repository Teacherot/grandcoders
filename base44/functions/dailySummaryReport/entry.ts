import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Daily summary report — invoked by a scheduled workflow every morning.
// Gathers yesterday's completed orders, computes per-agent commission
// (amount * commission_rate / 100, matching the dashboard formula), and
// emails an HTML summary to every admin user. Runs with the service role
// (no user context when triggered by a schedule).

const cedi = (n) => `GH₵ ${Number(n || 0).toFixed(2)}`;

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);

    // Reporting window: the previous calendar day, in UTC.
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));

    const [orders, agents, users] = await Promise.all([
      base44.asServiceRole.entities.Order.filter({ status: 'completed' }, '-created_date', 5000),
      base44.asServiceRole.entities.Agent.list(1000),
      base44.asServiceRole.entities.User.filter({ role: 'admin' }).catch(() => []),
    ]);

    const agentMap = new Map((agents || []).map((a) => [a.id, a]));
    const periodOrders = (orders || []).filter((o) => {
      const d = new Date(o.created_date);
      return d >= start && d < end;
    });

    const byAgent = new Map();
    let totalRevenue = 0;
    for (const o of periodOrders) {
      totalRevenue += Number(o.amount || 0);
      const agent = agentMap.get(o.agent_id);
      const rate = Number(agent?.commission_rate || 0);
      const commission = (Number(o.amount || 0) * rate) / 100;
      const key = o.agent_id || 'direct';
      const name = o.agent_name || agent?.full_name || 'Direct / Storefront';
      const entry = byAgent.get(key) || { name, rate, orders: 0, revenue: 0, commission: 0 };
      entry.orders += 1;
      entry.revenue += Number(o.amount || 0);
      entry.commission += commission;
      byAgent.set(key, entry);
    }

    const totalCommission = [...byAgent.values()].reduce((s, e) => s + e.commission, 0);
    const agentRows = [...byAgent.values()].sort((a, b) => b.revenue - a.revenue);
    const dateLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

    const agentTable = agentRows.length === 0
      ? `<p style="color:#64748b;font-size:14px">No completed orders for this day.</p>`
      : `<table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead><tr style="background:#f1f5f9">
            <th style="text-align:left;padding:10px;border-bottom:2px solid #e2e8f0">Agent</th>
            <th style="text-align:right;padding:10px;border-bottom:2px solid #e2e8f0">Orders</th>
            <th style="text-align:right;padding:10px;border-bottom:2px solid #e2e8f0">Revenue</th>
            <th style="text-align:right;padding:10px;border-bottom:2px solid #e2e8f0">Rate</th>
            <th style="text-align:right;padding:10px;border-bottom:2px solid #e2e8f0">Commission</th>
          </tr></thead>
          <tbody>
          ${agentRows.map((e, i) => `<tr style="background:${i % 2 ? '#f8fafc' : '#ffffff'}">
            <td style="padding:10px;border-bottom:1px solid #e2e8f0">${e.name}</td>
            <td style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0">${e.orders}</td>
            <td style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0">${cedi(e.revenue)}</td>
            <td style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0">${e.rate}%</td>
            <td style="text-align:right;padding:10px;border-bottom:1px solid #e2e8f0;font-weight:600">${cedi(e.commission)}</td>
          </tr>`).join('')}
          </tbody>
        </table>`;

    const html = `<!DOCTYPE html><html><body style="font-family:Inter,Arial,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:24px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="font-size:22px;margin:0">Daily Business Summary</h1>
        <p style="color:#64748b;margin:4px 0 0">${dateLabel}</p>
      </div>
      <div style="display:flex;gap:12px;margin-bottom:24px">
        <div style="flex:1;background:#eff6ff;border-radius:12px;padding:16px;text-align:center">
          <p style="font-size:12px;color:#1e40af;text-transform:uppercase;letter-spacing:0.05em;margin:0">Completed Orders</p>
          <p style="font-size:26px;font-weight:700;margin:4px 0 0">${periodOrders.length}</p>
        </div>
        <div style="flex:1;background:#ecfdf5;border-radius:12px;padding:16px;text-align:center">
          <p style="font-size:12px;color:#065f46;text-transform:uppercase;letter-spacing:0.05em;margin:0">Revenue</p>
          <p style="font-size:26px;font-weight:700;margin:4px 0 0">${cedi(totalRevenue)}</p>
        </div>
        <div style="flex:1;background:#fef3c7;border-radius:12px;padding:16px;text-align:center">
          <p style="font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:0.05em;margin:0">Commission</p>
          <p style="font-size:26px;font-weight:700;margin:4px 0 0">${cedi(totalCommission)}</p>
        </div>
      </div>
      <h2 style="font-size:16px;margin:0 0 12px">Agent breakdown</h2>
      ${agentTable}
      <p style="color:#94a3b8;font-size:12px;margin-top:24px;text-align:center">GrandCoders · Bundle Ops — automated daily report</p>
    </body></html>`;

    const recipients = (users || []).map((u) => u.email).filter(Boolean);
    if (recipients.length === 0) {
      return Response.json({ error: 'No admin recipients found' }, { status: 404 });
    }

    const subject = `Daily summary — ${dateLabel} · ${periodOrders.length} orders · ${cedi(totalRevenue)}`;
    for (const email of recipients) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject,
        body: html,
        from_name: 'GrandCoders Bundle Ops',
      });
    }

    return Response.json({
      ok: true,
      date: dateLabel,
      sent_to: recipients,
      completed_orders: periodOrders.length,
      total_revenue: totalRevenue,
      total_commission: totalCommission,
      agents: agentRows.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}