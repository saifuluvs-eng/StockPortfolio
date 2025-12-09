import { GoogleGenerativeAI } from "@google/generative-ai";

if (!process.env.GEMINI_API_KEY) {
  console.warn("GEMINI_API_KEY is not set. AI features will not work.");
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

export const aiService = {
  async analyzeChart(base64Image: string): Promise<string> {
    try {
      // Remove header if present (e.g., "data:image/png;base64,")
      const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, "");

      const prompt = `You are a professional Crypto Technical Analyst. You are looking at a TradingView chart image provided by the user.

Your Task:
1. Identify the Asset: Look at the top left of the chart to identify the Pair (e.g., BTC/USDT) and Timeframe.
2. Analyze Structure: Is the market trending (uptrend/downtrend) or ranging?
3. Pattern Recognition: Identify any visible candlestick patterns (e.g., Double Bottom, Head & Shoulders, Bullish Engulfing).
4. Key Levels: Estimate the Support and Resistance prices based on the visual axes.
5. Verdict: Provide a concise summary: Bullish, Bearish, or Neutral.

Formatting: Use Markdown (bolding, bullet points) for a clean UI display. Keep it under 200 words.`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: "image/png",
          },
        },
      ]);

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error analyzing chart with Gemini:", error);
      throw new Error("Failed to analyze chart");
    }
  },
};