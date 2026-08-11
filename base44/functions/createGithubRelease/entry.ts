import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const packageId = body.package_id || body.packageId;
    if (!packageId) {
      return Response.json({ error: "package_id is required" }, { status: 400 });
    }

    const pkg = await base44.asServiceRole.entities.Package.get(packageId);
    if (!pkg) {
      return Response.json({ error: "Package not found" }, { status: 404 });
    }

    const repo = (pkg.github_repo || "").trim();
    if (!repo) {
      return Response.json({ skipped: true, reason: "No github_repo set on package" });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("github");

    const rawCode = (pkg.code || pkg.name || "package").toString();
    const tag = "package-" + rawCode.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const name = `${pkg.name} deployed`;
    const lines = [
      `**${pkg.name}**`,
      "",
      `- **Network:** ${pkg.network}`,
      `- **Volume:** ${pkg.volume_gb ? pkg.volume_gb + " GB" : "N/A"}`,
      `- **Customer price:** GH₵${pkg.price}`,
    ];
    if (pkg.agent_price != null) lines.push(`- **Agent price:** GH₵${pkg.agent_price}`);
    if (pkg.validity) lines.push(`- **Validity:** ${pkg.validity}`);
    lines.push(`- **Status:** ${pkg.active ? "Active" : "Inactive"}`);
    lines.push(`- **Package code:** ${pkg.code || "—"}`);
    const releaseBody = lines.join("\n");

    const resp = await fetch(`https://api.github.com/repos/${repo}/releases`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        "User-Agent": "dataflow-pro-release-bot",
      },
      body: JSON.stringify({
        tag_name: tag,
        name,
        body: releaseBody,
        draft: false,
        prerelease: false,
      }),
    });
    const text = await resp.text();
    let data: any = null;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) {
      return Response.json({ error: (data && data.message) || "GitHub release failed", details: data, status: resp.status }, { status: 502 });
    }

    return Response.json({
      ok: true,
      release: { id: data.id, tag_name: data.tag_name, html_url: data.html_url },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}