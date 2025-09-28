// api/index.ts
export default function handler(_req: any, res: any) {
  res.status(200).json({ ok: true, message: "alive", time: new Date().toISOString() });
}
