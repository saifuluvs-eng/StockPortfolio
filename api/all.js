// api/all.js
export default function handler(req, res) {
  res.status(200).json({
    ok: true,
    route: "all",
    path: req.query?.path ?? null,
    time: new Date().toISOString(),
  });
}
