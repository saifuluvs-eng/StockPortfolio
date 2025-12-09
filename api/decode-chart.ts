import { VercelRequest, VercelResponse } from '@vercel/node';
import { aiService } from '../server/services/aiService';

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

        // Call the AI Service
        // Note: aiService logic assumes process.env.GEMINI_API_KEY is available in Vercel env
        const analysis = await aiService.analyzeChart(image);

        return sendJson(res, { data: analysis });
    } catch (error) {
        console.error('Chart Decode Error:', error);
        const msg = error instanceof Error ? error.message : 'Failed to analyze chart';
        return sendError(res, 500, msg);
    }
}
