export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json');

  const rawTarget = req.query?.from_url || req.query?.return_to || req.query?.redirect_to || '/login';
  const target = Array.isArray(rawTarget) ? rawTarget[0] : rawTarget;

  if (typeof target !== 'string' || !target.trim()) {
    res.status(200).json({ ok: true, redirectTo: '/login' });
    return;
  }

  try {
    const parsed = new URL(target);
    const allowedHostnames = ['grandcoders.vercel.app', 'localhost', '127.0.0.1'];
    const isSameOrigin = allowedHostnames.includes(parsed.hostname);

    if (isSameOrigin) {
      res.redirect(302, target);
      return;
    }
  } catch {
    // fall through to a safe local redirect for relative paths
  }

  if (target.startsWith('http://') || target.startsWith('https://')) {
    res.redirect(302, '/login');
    return;
  }

  res.redirect(302, target);
}
