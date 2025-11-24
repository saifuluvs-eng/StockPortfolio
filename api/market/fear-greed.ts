import type { VercelRequest, VercelResponse } from "@vercel/node";

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
const BASE_URL = "https://pro-api.coinmarketcap.com/v3";

async function getFearGreedIndex() {
  if (!COINMARKETCAP_API_KEY) {
    return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
  }

  try {
    const response = await fetch(
      `${BASE_URL}/fear-and-greed/historical?limit=1`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": COINMARKETCAP_API_KEY,
        },
      }
    );

    if (!response.ok) {
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    }

    const data = await response.json();
    
    if (!data.data || !data.data[0]) {
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    }

    const latest = data.data[0];
    return {
      value: latest.value,
      classification: latest.value_classification,
      timestamp: latest.timestamp,
    };
  } catch (error) {
    return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
  }
}

export default async (req: VercelRequest, res: VercelResponse) => {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const fgData = await getFearGreedIndex();
    
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.json(fgData);
  } catch (error: any) {
    console.error("Error fetching Fear & Greed index:", error?.message || error);
    return res.status(500).json({ 
      value: 50,
      classification: "Neutral",
      timestamp: String(Date.now()),
    });
  }
};
