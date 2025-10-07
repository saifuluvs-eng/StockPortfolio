import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import handler from "../insights";
import { aiService } from "../../services/aiService";

vi.mock("../../services/aiService", () => ({
  aiService: {
    generateMarketOverview: vi.fn(),
    analyzeMultipleCryptos: vi.fn(),
  },
}));

type JsonPayload = any;

const createMockResponse = () => {
  let jsonPayload: JsonPayload | undefined;
  const res: Partial<VercelResponse> & { jsonPayload?: JsonPayload } = {
    status: vi.fn().mockImplementation(function status(this: VercelResponse, _code: number) {
      return this;
    }),
    json: vi.fn().mockImplementation(function json(this: VercelResponse, payload: JsonPayload) {
      jsonPayload = payload;
      return payload;
    }),
    setHeader: vi.fn(),
  };
  Object.defineProperty(res, "jsonPayload", {
    get() {
      return jsonPayload;
    },
  });
  return res as VercelResponse & { jsonPayload?: JsonPayload };
};

describe("/api/ai/insights", () => {
  const mockedAiService = vi.mocked(aiService);
  const originalEnv = process.env.OPENAI_API_KEY;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockedAiService.generateMarketOverview.mockReset();
    mockedAiService.analyzeMultipleCryptos.mockReset();
    process.env.OPENAI_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalEnv;
    vi.unstubAllGlobals();
  });

  const sampleTicker = {
    symbol: "BTCUSDT",
    lastPrice: "65000",
    priceChange: "1500",
    priceChangePercent: "2.5",
    highPrice: "66000",
    lowPrice: "63000",
    volume: "1000",
    quoteVolume: "65000000",
  };

  it("returns AI-authored overview and symbol insights when available", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [sampleTicker],
    });

    const overview = {
      overallSentiment: "bullish",
      keyInsights: ["Insight"],
      tradingRecommendations: ["Trade"],
      riskAssessment: "Low risk",
    };
    const insights = [
      {
        symbol: "BTC",
        analysisType: "sentiment" as const,
        signal: "bullish" as const,
        confidence: 0.8,
        reasoning: "reason",
        recommendation: "buy",
        timeframe: "4h",
        metadata: { riskLevel: "medium" as const },
      },
    ];

    mockedAiService.generateMarketOverview.mockResolvedValue(overview);
    mockedAiService.analyzeMultipleCryptos.mockResolvedValue(insights);

    const res = createMockResponse();
    await handler({} as VercelRequest, res);

    expect(mockedAiService.generateMarketOverview).toHaveBeenCalled();
    expect(mockedAiService.analyzeMultipleCryptos).toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "s-maxage=180, stale-while-revalidate=300");

    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.marketOverview).toEqual(overview);
    expect(payload.symbolInsights).toEqual(insights);
    expect(Array.isArray(payload.heuristicHighlights)).toBe(true);
    expect(payload.table).toHaveLength(1);
    expect(typeof payload.lastUpdated).toBe("string");
  });

  it("falls back to heuristic summary when OpenAI is unavailable", async () => {
    process.env.OPENAI_API_KEY = "";
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => [sampleTicker],
    });

    const res = createMockResponse();
    await handler({} as VercelRequest, res);

    expect(mockedAiService.generateMarketOverview).not.toHaveBeenCalled();
    expect(mockedAiService.analyzeMultipleCryptos).not.toHaveBeenCalled();

    const payload = (res.json as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(payload.marketOverview).toMatchObject({ overallSentiment: expect.any(String) });
    expect(payload.symbolInsights).toEqual([]);
    expect(payload.heuristicHighlights.length).toBeGreaterThan(0);
  });
});
