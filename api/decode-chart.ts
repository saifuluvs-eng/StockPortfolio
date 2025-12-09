import { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Helper to handle CORS
function cors(res: VercelResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function sendError(res: VercelResponse, status: number, message: string): void {
    cors(res);
    res.status(status).json({ error: message });
}

function sendJson(res: VercelResponse, data: unknown): void {
    cors(res);
    res.status(200).json(data);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Handle Preflight
    if (req.method === 'OPTIONS') {
        cors(res);
        return res.status(200).end();
    }

    // Only allow POST
    if (req.method !== 'POST') {
        return sendError(res, 405, 'Method Not Allowed');
    }

    cors(res);

    try {
        const { image } = req.body;

        if (!image) {
            return sendError(res, 400, 'Image data is required');
        }

        if (!process.env.GEMINI_API_KEY) {
            console.error("Missing GEMINI_API_KEY in Vercel environment");
            return sendError(res, 500, "Server misconfiguration: AI key missing");
        }

        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        // Use specific version to avoid 404 on alias
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

        // Remove header if present (e.g., "data:image/png;base64,")
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");

        const prompt = `You are a professional Crypto Technical Analyst.
      Analyze this chart image and provide a structured report using exactly these headers:
      
      **Asset & Timeframe**
      [Identify Pair and Interval]

      **Market Structure**
      [Uptrend/Downtrend/Ranging + Brief explanation]

      **Key Levels**
      - Support: [Price]
      - Resistance: [Price]

      **Pattern Recognition**
      [Identify patterns like Double Bottom, Flags, etc. or "None visible"]

      **Verdict**
      [Bullish / Bearish / Neutral] - [One sentence summary]

      Keep it concise and professional.`;

        const result = await model.generateContent([
            prompt,
            {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/png",
                },
            },
        ]);

        const analysis = result.response.text();
        return sendJson(res, { data: analysis });
    } catch (error) {
        console.error('Chart Decode Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to analyze chart';
        return sendError(res, 500, msg);
    }
}
