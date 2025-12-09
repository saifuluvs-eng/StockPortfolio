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

      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error analyzing chart with Gemini:", error);
      throw new Error("Failed to analyze chart");
    }
  },
};