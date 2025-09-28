// api/ping.ts
export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, message: "pong", time: new Date().toISOString() });
}
