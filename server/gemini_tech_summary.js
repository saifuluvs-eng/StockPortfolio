/**
 * gemini_tech_summary.js
 * Complete single-file solution for computing technical indicators and sending to Gemini
 * 
 * USAGE:
 * const { runSummaryWithIndicators, runSummary } = require('./gemini_tech_summary.js');
 * 
 * Option 1: With pre-computed indicators
 * const final = await runSummaryWithIndicators({
 *   symbol: 'DASHUSDT',
 *   timeframe: '4h',
 *   indicatorsOverride: { price, ema20, ema50, vwap, rsi, macd, obvSeries, avgVol, atr, bbSqueeze }
 * });
 * 
 * Option 2: With OHLCV candles (computes indicators internally)
 * const result = await runSummary({ symbol: 'DASHUSDT', timeframe: '4h', candles: candlesArray });
 */

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

/* ========== Indicator Calculation Functions ========== */

function ema(values, period) {
  const res = Array(values.length).fill(null);
  if (!values || values.length < period) return res;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += values[i];
  let prev = sum / period;
  res[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    const v = values[i];
    const cur = v * k + prev * (1 - k);
    res[i] = cur;
    prev = cur;
  }
  return res;
}

function sma(values, period) {
  const res = Array(values.length).fill(null);
  if (!values || values.length < period) return res;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) res[i] = sum / period;
  }
  return res;
}

function rsi(values, period = 14) {
  const res = Array(values.length).fill(null);
  if (!values || values.length <= period) return res;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gains += d;
    else losses -= d;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  res[period] = 100 - (100 / (1 + avgGain / avgLoss));
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    const g = d > 0 ? d : 0;
    const l = d < 0 ? -d : 0;
    avgGain = (avgGain * (period - 1) + g) / period;
    avgLoss = (avgLoss * (period - 1) + l) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    res[i] = 100 - 100 / (1 + rs);
  }
  return res;
}

function macd(values, fast = 12, slow = 26, signal = 9) {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((v, i) => (emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null));
  const signalLine = ema(macdLine.map(v => (v == null ? 0 : v)), signal);
  const hist = macdLine.map((v, i) => (v != null && signalLine[i] != null ? v - signalLine[i] : null));
  return { macd: macdLine, signal: signalLine, hist };
}

function atr(candles, period = 14) {
  const res = Array(candles.length).fill(null);
  if (!candles || candles.length <= period) return res;
  const tr = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) {
      tr.push(candles[i].h - candles[i].l);
    } else {
      const cur = Math.max(
        candles[i].h - candles[i].l,
        Math.abs(candles[i].h - candles[i - 1].c),
        Math.abs(candles[i].l - candles[i - 1].c)
      );
      tr.push(cur);
    }
  }
  let sum = 0;
  for (let i = 0; i < period; i++) sum += tr[i];
  res[period - 1] = sum / period;
  for (let i = period; i < tr.length; i++) {
    res[i] = (res[i - 1] * (period - 1) + tr[i]) / period;
  }
  return res;
}

function bollingerBands(values, period = 20, mult = 2) {
  const middle = sma(values, period);
  const lower = Array(values.length).fill(null);
  const upper = Array(values.length).fill(null);
  const width = Array(values.length).fill(null);
  for (let i = period - 1; i < values.length; i++) {
    let sumSq = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = values[j] - middle[i];
      sumSq += d * d;
    }
    const sd = Math.sqrt(sumSq / period);
    lower[i] = middle[i] - mult * sd;
    upper[i] = middle[i] + mult * sd;
    width[i] = (upper[i] - lower[i]) / middle[i];
  }
  return { lower, middle, upper, width };
}

function vwap(candles) {
  const res = Array(candles.length).fill(null);
  let cumPV = 0, cumVol = 0;
  for (let i = 0; i < candles.length; i++) {
    const typical = (candles[i].h + candles[i].l + candles[i].c) / 3;
    const pv = typical * candles[i].v;
    cumPV += pv;
    cumVol += candles[i].v;
    res[i] = cumVol === 0 ? null : cumPV / cumVol;
  }
  return res;
}

function obv(candles) {
  const res = Array(candles.length).fill(null);
  let running = 0;
  res[0] = running;
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].c > candles[i - 1].c) running += candles[i].v;
    else if (candles[i].c < candles[i - 1].c) running -= candles[i].v;
    res[i] = running;
  }
  return res;
}

/* ========== Combined Fields Computation ========== */

function computeTrendBias(price, ema20Val, ema50Val, vwapVal) {
  let bias = "neutral";
  if (price < ema20Val && ema20Val < ema50Val) bias = "bearish";
  else if (price > ema20Val && ema20Val > ema50Val) bias = "bullish";
  
  if (vwapVal != null) {
    if (price < vwapVal && bias !== "bullish") bias = "bearish";
    if (price > vwapVal && bias !== "bearish") bias = "bullish";
  }
  
  if ((price > ema20Val && ema20Val < ema50Val) || (price < ema20Val && ema20Val > ema50Val)) bias = "neutral";
  return bias;
}

function computeMomentumState(rsiVal, macdVal) {
  if (rsiVal == null && macdVal == null) return "neutral";
  if (rsiVal != null) {
    if (rsiVal < 30) return "oversold";
    if (rsiVal > 70) return "overbought";
  }
  if (macdVal != null) {
    if (macdVal > 0) return "strong";
    if (macdVal < 0) return "weak";
  }
  if (rsiVal != null) {
    if (rsiVal >= 45 && rsiVal <= 55) return "neutral";
    if (rsiVal > 55) return "strong";
    if (rsiVal < 45) return "weak";
  }
  return "neutral";
}

function computeVolumeContext(obvSeries, avgVol, prevAvgVol) {
  if (obvSeries && obvSeries.length >= 3) {
    const last = obvSeries[obvSeries.length - 1];
    const prev = obvSeries[Math.max(0, obvSeries.length - 6)];
    if (last > prev) return "increasing";
    if (last < prev) return "decreasing";
  }
  if (avgVol != null && prevAvgVol != null) {
    if (avgVol > prevAvgVol) return "increasing";
    if (avgVol < prevAvgVol) return "decreasing";
  }
  return "neutral";
}

function computeVolatilityState(bbSqueezeFlag, atrVal) {
  if (bbSqueezeFlag === 1) return "low";
  if (atrVal != null) {
    if (atrVal < 0.5) return "low";
    if (atrVal > 2.0) return "high";
  }
  return "normal";
}

/* ========== Gemini API Call ========== */

async function callGemini(prompt) {
  if (!GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: controller.signal,
    });

    if (response.status === 429) {
      throw new Error("Rate limited by Gemini API");
    }

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const json = await response.json();
    const result = json.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!result) {
      throw new Error("No response from Gemini API");
    }

    return result;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* ========== Main Export Functions ========== */

async function runSummaryWithIndicators({ symbol, timeframe, indicatorsOverride }) {
  try {
    const price = indicatorsOverride.price || 0;
    const ema20Val = indicatorsOverride.ema20 || null;
    const ema50Val = indicatorsOverride.ema50 || null;
    const vwapVal = indicatorsOverride.vwap || null;
    const rsiVal = indicatorsOverride.rsi || null;
    const macdVal = indicatorsOverride.macd || null;
    const obvSeries = indicatorsOverride.obvSeries || [];
    const avgVol = indicatorsOverride.avgVol || null;
    const prevAvgVol = indicatorsOverride.prevAvgVol || null;
    const atrVal = indicatorsOverride.atr || null;
    const bbSqueezeFlag = indicatorsOverride.bbSqueeze ? 1 : 0;

    // Compute combined fields
    const trend_bias = computeTrendBias(price, ema20Val, ema50Val, vwapVal);
    const momentum_state = computeMomentumState(rsiVal, macdVal);
    const volume_context = computeVolumeContext(obvSeries, avgVol, prevAvgVol);
    const volatility_state = computeVolatilityState(bbSqueezeFlag, atrVal);

    const finalJson = {
      symbol,
      timeframe,
      price,
      trend_bias,
      momentum_state,
      volume_context,
      volatility_state,
    };

    console.log("FINAL JSON sent to Gemini:", JSON.stringify(finalJson, null, 2));

    // Build prompt
    const prompt = `You are a professional cryptocurrency trader analyzing ${symbol} on ${timeframe}.
Write ONLY trader-style analysis using general market language.

ABSOLUTE REQUIREMENT:
- NEVER mention any indicator names (EMA, MACD, RSI, VWAP, etc.)
- Write as if explaining to another trader
- Use only the market state provided below

Format your response EXACTLY like this:

### AI Summary — ${symbol} (${timeframe})

**Overall Bias:** [Bullish / Bearish / Neutral]

**Why:**
- [One insight - use general market language]
- [One insight - no indicator names]
- [One insight - no numbers or percentages]

**What to expect:**
- [Expected price action based on current setup]

**Key Levels:**
- Support: [Description without numbers]
- Resistance: [Description without numbers]

**Risk Alert:**
- [One key risk factor]

MARKET STATE:
${JSON.stringify(finalJson, null, 2)}`;

    const geminiText = await callGemini(prompt);
    
    return {
      symbol,
      timeframe,
      geminiText,
      finalJson,
    };
  } catch (error) {
    console.error("Error in runSummaryWithIndicators:", error);
    throw error;
  }
}

async function runSummary({ symbol, timeframe, candles }) {
  try {
    if (!candles || candles.length === 0) {
      throw new Error("No candles provided");
    }

    const closes = candles.map(c => c.c);
    const ema20Arr = ema(closes, 20);
    const ema50Arr = ema(closes, 50);
    const rsiArr = rsi(closes, 14);
    const macdObj = macd(closes);
    const obvArr = obv(candles);
    const atrArr = atr(candles, 14);
    const bbObj = bollingerBands(closes, 20, 2);
    const vwapArr = vwap(candles);

    const lastIdx = candles.length - 1;
    const price = closes[lastIdx];
    const ema20Val = ema20Arr[lastIdx];
    const ema50Val = ema50Arr[lastIdx];
    const rsiVal = rsiArr[lastIdx];
    const macdVal = macdObj.macd[lastIdx];
    const obvSeries = obvArr.slice(-20);
    const atrVal = atrArr[lastIdx];
    const vwapVal = vwapArr[lastIdx];
    const bbWidth = bbObj.width[lastIdx];
    const bbSqueeze = bbWidth < 0.02; // Example threshold

    // Average volume calculation
    const volumeWindow = candles.slice(-20);
    const avgVol = volumeWindow.reduce((sum, c) => sum + c.v, 0) / volumeWindow.length;
    const prevAvgVol = candles.slice(-40, -20).reduce((sum, c) => sum + c.v, 0) / Math.min(20, candles.length - 20);

    return runSummaryWithIndicators({
      symbol,
      timeframe,
      indicatorsOverride: {
        price,
        ema20: ema20Val,
        ema50: ema50Val,
        vwap: vwapVal,
        rsi: rsiVal,
        macd: macdVal,
        obvSeries,
        avgVol,
        prevAvgVol,
        atr: atrVal,
        bbSqueeze,
      },
    });
  } catch (error) {
    console.error("Error in runSummary:", error);
    throw error;
  }
}

module.exports = {
  runSummary,
  runSummaryWithIndicators,
  callGemini,
};
