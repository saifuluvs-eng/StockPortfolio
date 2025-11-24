import type { VercelRequest, VercelResponse } from "@vercel/node";

const BASE_URL = "https://pro-api.coinmarketcap.com/v3";

async function getFearGreedIndex() {
  // Read API key at invocation time (not module load time) - fixes Vercel env var injection
  const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY;
  
  // DEBUG: Check if API key is accessible
  console.log("[Fear & Greed API] Environment variables check:");
  console.log("[Fear & Greed API] COINMARKETCAP_API_KEY exists:", !!COINMARKETCAP_API_KEY);
  console.log("[Fear & Greed API] COINMARKETCAP_API_KEY length:", COINMARKETCAP_API_KEY?.length || 0);
  
  if (!COINMARKETCAP_API_KEY) {
    console.log("[Fear & Greed API] ⚠️ API key NOT found - returning fallback");
    return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
  }
  
  console.log("[Fear & Greed API] ✅ API key found - making fetch request");

  try {
    console.log("[Fear & Greed API] Fetching from CoinMarketCap...");
    const response = await fetch(
      `${BASE_URL}/fear-and-greed/historical?limit=1`,
      {
        headers: {
          "X-CMC_PRO_API_KEY": COINMARKETCAP_API_KEY,
        },
      }
    );

    console.log("[Fear & Greed API] Response status:", response.status);

    if (!response.ok) {
      console.log("[Fear & Greed API] ❌ API request failed with status", response.status);
      console.log("[Fear & Greed API] Response body:", await response.text());
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    }

    const data = await response.json();
    console.log("[Fear & Greed API] ✅ API response received:", JSON.stringify(data));
    
    if (!data.data || !data.data[0]) {
      console.log("[Fear & Greed API] ⚠️ No data in API response");
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    }

    const latest = data.data[0];
    const result = {
      value: latest.value,
      classification: latest.value_classification,
      timestamp: latest.timestamp,
    };
    console.log("[Fear & Greed API] ✅ Returning result:", result);
    return result;
  } catch (error) {
    console.log("[Fear & Greed API] ❌ Error caught:", error instanceof Error ? error.message : String(error));
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
