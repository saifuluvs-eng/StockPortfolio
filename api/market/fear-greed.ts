async function getFearGreedIndex() {
  try {
    console.log("[Fear & Greed API] Fetching from Alternative.me...");
    const response = await fetch("https://api.alternative.me/fng/?limit=1");

    if (!response.ok) {
      console.log("[Fear & Greed API] ❌ API request failed with status", response.status);
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    }

    const data = await response.json();
    console.log("[Fear & Greed API] ✅ API response received:", JSON.stringify(data));

    if (!data.data || !data.data[0]) {
      console.log("[Fear & Greed API] ⚠️ No data in API response");
      return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
    }

    const latest = data.data[0];
    // Alternative.me returns string values, need to parse
    const value = parseInt(latest.value, 10);

    const result = {
      value: isNaN(value) ? 50 : value,
      classification: latest.value_classification,
      timestamp: latest.timestamp, // Alternative.me returns unix timestamp string
    };
    console.log("[Fear & Greed API] ✅ Returning result:", result);
    return result;
  } catch (error) {
    console.log("[Fear & Greed API] ❌ Error caught:", error instanceof Error ? error.message : String(error));
    return { value: 50, classification: "Neutral", timestamp: String(Date.now()) };
  }
}

export default async (req: any, res: any) => {
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
}
