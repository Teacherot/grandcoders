export default function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.status(200).json({
    ok: true,
    service: 'grandcoders-backend',
    status: 'healthy',
    message: 'Backend is up and ready for the next migration step.',
  });
}
