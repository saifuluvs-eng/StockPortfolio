/**
 * gemini_tech_summary.js
 *
 * Complete single-file solution:
 * - Calculates indicators from OHLCV arrays
 * - Computes combined fields: trend_bias, momentum_state, volume_context, volatility_state
 * - Builds final JSON and injects into prompt template
 * - Sends request to Gemini generative API
 *
 * USAGE:
 * 1) Set GEMINI_API_KEY in Replit environment variables.
 * 2) Provide OHLCV arrays or precomputed indicator values.
 * 3) Call runSummary({symbol, timeframe, candles}) or runSummaryWithIndicators(...)
 *
 * NOTE: This is a complete working template. Replace data fetch + scheduling with your app's flow.
 *
 * Local file reference you uploaded (for your debugging/visual check):
 * /mnt/data/8c14d96f-492e-40eb-86e2-f3a5de03e788.png
 */

/* ========== Minimal helper functions for indicators (no external deps) ========== */

/**
 * ema(data, period) - data is array of numbers (closing prices), returns array of EMA values (same length, first (period-1) entries null)
 */
function ema(values, period) {
    const res = Array(values.length).fill(null);
    if (!values || values.length < period) return res;
    const k = 2 / (period + 1);
    // start with SMA for first EMA seed
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

/**
 * sma(values, period)
 */
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

/**
 * rsi: returns array with RSI (14 default)
 */
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

/**
 * macd: returns object {macd, signal, hist} arrays
 * uses defaults: fast=12, slow=26, signal=9
 */
function macd(values, fast = 12, slow = 26, signal = 9) {
    const emaFast = ema(values, fast);
    const emaSlow = ema(values, slow);
    const macdLine = values.map((v, i) => (emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null));
    const signalLine = ema(macdLine.map(v => (v == null ? 0 : v)), signal); // treat null as 0 for smoothing but results earlier will be null
    const hist = macdLine.map((v, i) => (v != null && signalLine[i] != null ? v - signalLine[i] : null));
    return { macd: macdLine, signal: signalLine, hist };
}

/**
 * atr: average true range, period default 14
 * candles: array of {o,h,l,c,v}
 */
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
    // sma of TR first then Wilder smoothing
    let sum = 0;
    for (let i = 0; i < period; i++) sum += tr[i];
    res[period - 1] = sum / period;
    for (let i = period; i < tr.length; i++) {
        res[i] = (res[i - 1] * (period - 1) + tr[i]) / period;
    }
    return res;
}

/**
 * bollingerBands: returns {lower, middle, upper, width} arrays
 */
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

/**
 * vwap: requires intraday ticks or candlestick with volume; simplified VWAP across array:
 * compute cumulative (price*vol)/cumulative vol using close as price
 */
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

/**
 * obv: On-Balance Volume
 */
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

/**
 * stochastic %K and %D - returns {k, d}
 * kPeriod default 14, dPeriod default 3
 */
function stochastic(candles, kPeriod = 14, dPeriod = 3) {
    const k = Array(candles.length).fill(null);
    const d = Array(candles.length).fill(null);
    for (let i = kPeriod - 1; i < candles.length; i++) {
        let highest = -Infinity;
        let lowest = Infinity;
        for (let j = i - kPeriod + 1; j <= i; j++) {
            if (candles[j].h > highest) highest = candles[j].h;
            if (candles[j].l < lowest) lowest = candles[j].l;
        }
        k[i] = ((candles[i].c - lowest) / (highest - lowest)) * 100;
    }
    const kValues = k.map(v => (v == null ? 0 : v));
    const dArr = sma(kValues, dPeriod);
    for (let i = 0; i < dArr.length; i++) d[i] = dArr[i];
    return { k, d };
}

/**
 * williamsR - %R = (HighestHigh - Close) / (HighestHigh - LowestLow) * -100
 */
function williamsR(candles, period = 14) {
    const res = Array(candles.length).fill(null);
    for (let i = period - 1; i < candles.length; i++) {
        let hh = -Infinity, ll = Infinity;
        for (let j = i - period + 1; j <= i; j++) {
            if (candles[j].h > hh) hh = candles[j].h;
            if (candles[j].l < ll) ll = candles[j].l;
        }
        res[i] = ((hh - candles[i].c) / (hh - ll)) * -100;
    }
    return res;
}

/**
 * simple PSAR (Parabolic SAR) implementation - returns array psar
 * This is a light implementation and not bulletproof for edge cases.
 */
function psar(candles, step = 0.02, maxStep = 0.2) {
    const psar = Array(candles.length).fill(null);
    if (candles.length === 0) return psar;
    let up = true; // start with assumed trend up
    let af = step;
    let ep = candles[0].h; // extreme point
    let sar = candles[0].l;
    psar[0] = sar;
    for (let i = 1; i < candles.length; i++) {
        sar = sar + af * (ep - sar);
        if (up) {
            if (candles[i].l < sar) {
                // switch to down
                up = false;
                sar = ep;
                ep = candles[i].l;
                af = step;
            } else {
                if (candles[i].h > ep) {
                    ep = candles[i].h;
                    af = Math.min(af + step, maxStep);
                }
            }
        } else {
            if (candles[i].h > sar) {
                // switch to up
                up = true;
                sar = ep;
                ep = candles[i].h;
                af = step;
            } else {
                if (candles[i].l < ep) {
                    ep = candles[i].l;
                    af = Math.min(af + step, maxStep);
                }
            }
        }
        psar[i] = sar;
    }
    return psar;
}

/**
 * ADX simplified - returns ADX array
 * Uses DX = 100 * (|+DI - -DI| / (|+DI + -DI|)), then ADX is smoothed DX (Wilder)
 * This is simplified for speed and readability.
 */
function adx(candles, period = 14) {
    const length = candles.length;
    const tr = Array(length).fill(0);
    const plusDM = Array(length).fill(0);
    const minusDM = Array(length).fill(0);
    for (let i = 1; i < length; i++) {
        const upMove = candles[i].h - candles[i - 1].h;
        const downMove = candles[i - 1].l - candles[i].l;
        plusDM[i] = upMove > downMove && upMove > 0 ? upMove : 0;
        minusDM[i] = downMove > upMove && downMove > 0 ? downMove : 0;
        tr[i] = Math.max(candles[i].h - candles[i].l, Math.abs(candles[i].h - candles[i - 1].c), Math.abs(candles[i].l - candles[i - 1].c));
    }
    const atrArr = atr(candles, period);
    const plusDI = Array(length).fill(null);
    const minusDI = Array(length).fill(null);
    for (let i = 0; i < length; i++) {
        if (atrArr[i]) {
            plusDI[i] = (100 * (plusDM[i] / atrArr[i]));
            minusDI[i] = (100 * (minusDM[i] / atrArr[i]));
        } else {
            plusDI[i] = null;
            minusDI[i] = null;
        }
    }
    const dx = Array(length).fill(null);
    for (let i = 0; i < length; i++) {
        if (plusDI[i] != null && minusDI[i] != null && (plusDI[i] + minusDI[i]) !== 0) {
            dx[i] = (100 * Math.abs(plusDI[i] - minusDI[i]) / (plusDI[i] + minusDI[i]));
        } else dx[i] = null;
    }
    // ADX smoothing (Wilder)
    const adxArr = Array(length).fill(null);
    let sumDX = 0, startIdx = period;
    for (let i = startIdx; i < startIdx * 2 && i < dx.length; i++) {
        if (dx[i] != null) sumDX += dx[i];
    }
    if (dx[startIdx]) {
        adxArr[startIdx] = sumDX / period;
        for (let i = startIdx + 1; i < dx.length; i++) {
            if (adxArr[i - 1] != null && dx[i] != null) {
                adxArr[i] = ((adxArr[i - 1] * (period - 1)) + dx[i]) / period;
            } else adxArr[i] = null;
        }
    }
    return adxArr;
}

/* ========== Combined fields logic (rules) ========== */

/**
 * computeTrendBias
 * Rules:
 * - Use EMA20, EMA50 and price; VWAP as influence
 * - If contradictory -> neutral
 */
function computeTrendBiasFromValues(price, ema20Val, ema50Val, vwapVal) {
    let bias = "neutral";
    if (price < ema20Val && ema20Val < ema50Val) bias = "bearish";
    else if (price > ema20Val && ema20Val > ema50Val) bias = "bullish";

    // VWAP influence (should not override strong EMA structure)
    if (vwapVal != null) {
        if (price < vwapVal && bias !== "bullish") bias = "bearish";
        if (price > vwapVal && bias !== "bearish") bias = "bullish";
    }

    // Contradictory checks
    if ((price > ema20Val && ema20Val < ema50Val) || (price < ema20Val && ema20Val > ema50Val)) bias = "neutral";
    return bias;
}

/**
 * computeMomentumStateFromValues
 */
function computeMomentumStateFromValues(rsiVal, macdVal) {
    if (rsiVal == null && macdVal == null) return "neutral";
    if (rsiVal != null) {
        if (rsiVal < 30) return "oversold";
        if (rsiVal > 70) return "overbought";
    }
    if (macdVal != null) {
        if (macdVal > 0) {
            if (rsiVal != null && rsiVal > 55) return "strong";
            return "strong";
        }
        if (macdVal < 0) {
            if (rsiVal != null && rsiVal < 45) return "weak";
            return "weak";
        }
    }
    if (rsiVal != null) {
        if (rsiVal >= 45 && rsiVal <= 55) return "neutral";
        if (rsiVal > 55) return "strong";
        if (rsiVal < 45) return "weak";
    }
    return "neutral";
}

/**
 * computeVolumeContextFromValues
 * Input: obvSeries (array) optional OR avgVol and prevAvgVol
 */
function computeVolumeContextFromValues(obvSeries, avgVol, prevAvgVol) {
    if (obvSeries && obvSeries.length >= 3) {
        // check last trend: last value vs value N candles ago
        const last = obvSeries[obvSeries.length - 1];
        const prev = obvSeries[Math.max(0, obvSeries.length - 6)]; // check 5-candle back
        if (last > prev) return "increasing";
        if (last < prev) return "decreasing";
    }
    if (avgVol != null && prevAvgVol != null) {
        if (avgVol > prevAvgVol) return "increasing";
        if (avgVol < prevAvgVol) return "decreasing";
    }
    return "neutral";
}

/**
 * computeVolatilityStateFromValues
 */
function computeVolatilityStateFromValues(bbSqueezeFlag, atrVal) {
    if (bbSqueezeFlag === 1) return "low";
    if (atrVal != null) {
        // thresholds are relative; you may tune these to asset volatility
        if (atrVal < 0.5) return "low";
        if (atrVal > 2.0) return "high";
    }
    return "normal";
}

/* =======================================================
   SUPPORT / RESISTANCE ENGINE (Option D - Full Suite)
   ======================================================= */

/* -----------------------------
   A. BASIC SWING HIGH/LOW LOGIC
   ----------------------------- */
function findSwingLevels(candles, lookback = 60) {
    const supports = [];
    const resistances = [];
    const n = candles.length;
    const start = Math.max(2, n - lookback);

    for (let i = start; i < n - 2; i++) {
        const prev1 = candles[i - 1];
        const prev2 = candles[i - 2];
        const curr = candles[i];
        const next1 = candles[i + 1];
        const next2 = candles[i + 2];

        // Local support (swing low)
        if (
            curr.l < prev1.l && curr.l < prev2.l &&
            curr.l < next1.l && curr.l < next2.l
        ) {
            supports.push(curr.l);
        }

        // Local resistance (swing high)
        if (
            curr.h > prev1.h && curr.h > prev2.h &&
            curr.h > next1.h && curr.h > next2.h
        ) {
            resistances.push(curr.h);
        }
    }

    return {
        supports: [...new Set(supports)].sort((a, b) => a - b),
        resistances: [...new Set(resistances)].sort((a, b) => a - b),
    };
}

/* --------------------------------------------------
   B. LIQUIDITY ZONES (Institutional wick clustering)
   -------------------------------------------------- */
function findLiquidityZones(candles, thresholdPct = 0.003) {
    const lows = candles.map(c => c.l).sort((a, b) => a - b);
    const highs = candles.map(c => c.h).sort((a, b) => a - b);

    const supportZones = [];
    const resistanceZones = [];

    // Cluster lows → support zones
    for (let i = 1; i < lows.length; i++) {
        const diff = Math.abs((lows[i] - lows[i - 1]) / lows[i - 1]);
        if (diff < thresholdPct) supportZones.push(lows[i]);
    }

    // Cluster highs → resistance zones
    for (let i = 1; i < highs.length; i++) {
        const diff = Math.abs((highs[i] - highs[i - 1]) / highs[i - 1]);
        if (diff < thresholdPct) resistanceZones.push(highs[i]);
    }

    return {
        supportZones: [...new Set(supportZones)].sort((a, b) => a - b),
        resistanceZones: [...new Set(resistanceZones)].sort((a, b) => a - b),
    };
}

/* --------------------------------------------
   C. SOFT ZONES (Range Midpoints & Price Memory)
   -------------------------------------------- */
function findSoftZones(candles, depth = 40) {
    const sliced = candles.slice(-depth);
    const lows = sliced.map(c => c.l);
    const highs = sliced.map(c => c.h);

    const softSupport = Math.min(...lows);
    const softResistance = Math.max(...highs);

    const midpoint = (softSupport + softResistance) / 2;

    return {
        softSupport,
        softResistance,
        midpoint
    };
}

/* ----------------------------------------
   D. UNIFIED SUPPORT / RESISTANCE OUTPUT
   ---------------------------------------- */
function computeUnifiedSupportResistance(candles) {
    const swings = findSwingLevels(candles);
    const liquidity = findLiquidityZones(candles);
    const soft = findSoftZones(candles);

    // Combine all into unified arrays
    let support = [
        ...swings.supports,
        ...liquidity.supportZones,
        soft.softSupport,
        soft.midpoint
    ];

    let resistance = [
        ...swings.resistances,
        ...liquidity.resistanceZones,
        soft.softResistance,
        soft.midpoint
    ];

    // Remove duplicates + sort
    support = [...new Set(support)].sort((a, b) => a - b).slice(0, 5);      // top 5 levels max
    resistance = [...new Set(resistance)].sort((a, b) => a - b).slice(-5);  // top 5 levels max

    return { support, resistance };
}

/* ========== Final JSON builder + Gemini prompt builder ========== */

/**
 * promptTemplate: short, strict instructions for Gemini
 * This template expects {{TECHNICALS_JSON}} to be replaced with final JSON.
 */
const promptTemplate = `
You are an institutional-grade crypto market analyst.  
You will be given a JSON object with combined technical fields.  
You must produce short, research-desk style analysis that sounds like a professional from Delphi, Nansen, GSR, or Binance Research.

====================
GLOBAL RULES
====================

1. NEVER mention indicators by name (no EMA, RSI, MACD, VWAP, ADX, CCI, Stoch, etc).
2. NEVER mention indicator values.
3. ONLY use these combined fields to reason:
   - trend_bias
   - momentum_state
   - volume_context
   - volatility_state
   - support
   - resistance

4. ALWAYS produce institutional-grade insights by combining multiple signals into a single interpretation.
5. ALWAYS use professional, trader-level vocabulary.

====================
ELITE UPGRADE LAYER
====================

Incorporate advanced institutional microstructure concepts.
Use deeper analyst-grade language such as:

FLOW DYNAMICS:
- initiative flows (aggressive market orders), passive absorption (limit order defense), rotational flow bias, bid-side absorption / ask-side absorption, lack of initiative buyers / sellers, flow imbalance, thin liquidity pockets, failed displacement, displacement pressure building

PRICE ACTION STRUCTURE:
- wick rejections, high-timeframe overhang, structural compression, controlled drift, inefficiency fill potential, failed breakout structure, defended lows / defended highs, liquidity sweeps

MOMENTUM REGIMES:
- directional impulse strengthening, momentum decay, impulse fragmentation, follow-through failure, exhaustion signals

VOLATILITY REGIMES:
- compression regime (coiling), expansion regime (instability), volatility pockets, expansion spillover risk, volatility skew

Use these concepts **only when supported by the combined fields**, never invent data.

When describing market behavior, always connect:
- trend_bias → directional structure
- momentum_state → impulse quality
- volume_context → participation confidence
- volatility_state → regime + risk quality

====================
COLOR CODE SYSTEM
====================

BIAS COLORS:
- Strong Bullish → 🟢
- Bullish → 🟩
- Bullish (Weak) → 🟢🟨
- Neutral (Leaning Bullish) → 🟨
- Neutral → ⚪
- Neutral (Leaning Bearish) → 🟧
- Bearish → 🟥
- Bearish (Weak) → 🟥🟨
- Strong Bearish → 🔴

RISK COLORS:
- High risk → 🔴
- Medium risk → 🟠
- Low risk → 🟢

VOLATILITY COLORS:
- Low volatility → 🔵
- Normal volatility → ⚪
- High volatility → 🟣

====================
BIAS ENGINE (MANDATORY)
====================

Determine the final bias using this logic AND prepend the appropriate color code:

IF trend_bias = "bullish":
    ELSE: Bias = "Bullish"

IF trend_bias = "bearish":
    IF momentum_state = "strong": Bias = "Strong Bearish"
    ELSE IF momentum_state = "weak": Bias = "Bearish (Weak)"
    ELSE: Bias = "Bearish"

IF trend_bias = "neutral":
    IF momentum_state = "strong": Bias = "Neutral (Leaning Bullish)"
    ELSE IF momentum_state = "weak": Bias = "Neutral (Leaning Bearish)"
    ELSE: Bias = "Neutral"

====================
BIAS ENGINE × VOCABULARY FUSION MATRIX
====================

When generating the summary, apply this bias-to-language fusion matrix:

Strong Bullish:
- use terms like "strong directional impulse", "aggressive buyer flows", "trend integrity high"

Bullish:
- use "buyer-sided pressure", "constructive structure", "momentum follow-through supportive"

Bullish (Weak):
- use "fragile upside extension", "incomplete buyer commitment", "limited upside drive"

Neutral (Leaning Bullish):
- use "subtle bullish tilt", "mild bid-side presence", "buyers quietly absorbing"

Neutral:
- use "balanced flows", "non-directional structure", "range-bound drift"

Neutral (Leaning Bearish):
- use "subtle downside pressure", "rotational drift lower", "sellers maintaining mild overhang"

Bearish:
- use "downside pressure", "seller-driven flow", "momentum skewed lower"

Bearish (Weak):
- use "fragile downside continuation", "weak impulse lower", "limited seller follow-through"

Strong Bearish:
- use "heavy downside control", "aggressive seller flows", "momentum exhaustion on the bid side"

====================
OUTPUT FORMAT (MANDATORY)
====================

### AI Summary — {{symbol}} {{timeframe}}

**Overall Bias:** {calculated final bias}

**Why:**
Provide 3–4 institutional-grade bullets that:
- combine trend + momentum + volume + volatility  
- explain the interaction between signals  
- describe how market participants behave  
- describe the quality of the trend (integrity, exhaustion, pressure, defense)

**What to Expect Next:**
1–2 sentences describing directional lean and likelihood of continuation vs fade.
PREMIUM INSIGHT RULES:
- If volume_context = decreasing → mention lack of commitment or weak participation.
- If volume_context = increasing → mention building flows or strengthening conviction.
- If volatility_state = low → mention compression or coiling behavior.
- If volatility_state = high → mention expansion or instability.
- If momentum_state = weak → mention fading impulses or exhaustion.
- If momentum_state = strong → mention follow-through or directional drive.

**Levels to Watch:**
- use support/resistance arrays from the JSON  
- NEVER invent new levels  
- if empty: “No levels provided.”

**Risk:**
One short, trader-grade line describing:
- trend fragility
- volatility traps
- exhaustion risk
- breakout/fakeout probability

====================
JSON DATA:

{{TECHNICALS_JSON}}
`;

/**
 * buildFinalJSONAndPrompt - accepts either raw candles OR precomputed indicator object
 * - candles: array of {t,o,h,l,c,v}
 * - indicatorsOverride: optional object with precomputed fields
 */
function buildFinalJSONAndPrompt({ symbol, timeframe, candles = null, indicatorsOverride = null }) {
    // If indicatorsOverride provided, copy through, else compute from candles
    let indicators = {};
    if (indicatorsOverride && Object.keys(indicatorsOverride).length > 0) {
        indicators = indicatorsOverride;
    } else {
        if (!candles || candles.length < 20) {
            throw new Error("Provide candles array with at least 20 elements OR precomputed indicators");
        }
        const closes = candles.map(c => c.c);
        const highs = candles.map(c => c.h);
        const lows = candles.map(c => c.l);
        const vols = candles.map(c => c.v);
        // compute indicators (last values)
        const ema20Arr = ema(closes, 20);
        const ema50Arr = ema(closes, 50);
        const rsiArr = rsi(closes, 14);
        const macdObj = macd(closes);
        const atrArr = atr(candles, 14);
        const bb = bollingerBands(closes, 20, 2);
        const vwapArr = vwap(candles);
        const obvArr = obv(candles);
        const stochObj = stochastic(candles, 14, 3);
        const willR = williamsR(candles, 14);
        const psarArr = psar(candles);
        const adxArr = adx(candles, 14);

        const lastIdx = candles.length - 1;
        indicators = {
            price: closes[lastIdx],
            open: candles[lastIdx].o,
            high: highs[lastIdx],
            low: lows[lastIdx],
            close: closes[lastIdx],
            volume: vols[lastIdx],
            ema20: ema20Arr[lastIdx],
            ema50: ema50Arr[lastIdx],
            ema200: ema(closes, 200)[lastIdx] || null,
            sma20: sma(closes, 20)[lastIdx],
            sma50: sma(closes, 50)[lastIdx],
            rsi: rsiArr[lastIdx],
            macd: macdObj.macd[lastIdx],
            macdSignal: macdObj.signal[lastIdx],
            macdHist: macdObj.hist[lastIdx],
            atr: atrArr[lastIdx],
            bbLower: bb.lower[lastIdx],
            bbMiddle: bb.middle[lastIdx],
            bbUpper: bb.upper[lastIdx],
            bbWidth: bb.width[lastIdx],
            bbSqueeze: bb.width[lastIdx] != null && bb.width[lastIdx] < 0.02 ? 1 : 0, // threshold tweakable
            vwap: vwapArr[lastIdx],
            obv: obvArr[lastIdx],
            obvSeries: obvArr.slice(-20),
            stochK: stochObj.k[lastIdx],
            stochD: stochObj.d[lastIdx],
            williamsR: willR[lastIdx],
            psar: psarArr[lastIdx],
            adx: adxArr[lastIdx],
            avgVol: (vols.slice(-10).reduce((a, b) => a + b, 0) / 10) || null,
            prevAvgVol: (vols.slice(-20, -10).reduce((a, b) => a + b, 0) / 10) || null
        };
    }

    // Compute combined fields
    const trend_bias = computeTrendBiasFromValues(
        indicators.price,
        indicators.ema20,
        indicators.ema50,
        indicators.vwap
    );
    const momentum_state = computeMomentumStateFromValues(indicators.rsi, indicators.macd);
    const volume_context = computeVolumeContextFromValues(indicators.obvSeries, indicators.avgVol, indicators.prevAvgVol);
    const volatility_state = computeVolatilityStateFromValues(indicators.bbSqueeze, indicators.atr);

    // Support/resistance detection
    let support = [];
    let resistance = [];
    if (candles) {
        const sr = computeUnifiedSupportResistance(candles);
        support = sr.support;
        resistance = sr.resistance;
    }

    const finalJson = {
        symbol,
        timeframe,
        timestamp: new Date().toISOString(),
        indicators,
        trend_bias,
        momentum_state,
        volume_context,
        volatility_state,
        support,
        resistance
    };

    // prompt assemble
    const prompt = promptTemplate
        .replace("{{symbol}}", symbol)
        .replace("{{timeframe}}", timeframe)
        .replace("{{TECHNICALS_JSON}}", JSON.stringify(finalJson, null, 2));

    return { finalJson, prompt };
}

/* ========== Gemini API call ========== */

/**
 * sendToGemini(prompt)
 * Sends prompt to Gemini generateContent endpoint and returns text candidate
 *
 * Ensure process.env.GEMINI_API_KEY is set in your Replit environment variables
 */
// const fetch = require("node-fetch"); // Removed: using global fetch

async function sendToGemini(prompt) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) throw new Error("GEMINI_API_KEY not set in environment variables");

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`;
    const body = {
        // Use a single content part containing the prompt
        "contents": [
            { "parts": [{ "text": prompt }] }
        ],
        // Configuration must be nested in generationConfig
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 300
        }
    };

    console.log("SENDING TO GEMINI. Prompt length:", prompt.length);
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Gemini API error: ${resp.status} ${txt}`);
    }
    const json = await resp.json();
    // Attempt to extract candidate text robustly
    const candidate = json?.candidates?.[0]?.content?.parts?.[0]?.text || json?.candidates?.[0]?.output || JSON.stringify(json);
    return { raw: json, text: candidate };
}

/* ========== Public runner functions ========== */

/**
 * runSummary({symbol, timeframe, candles})
 * - candles: array of {t,o,h,l,c,v}
 * returns Gemini response text + finalJson (for logs)
 */
async function runSummary({ symbol, timeframe, candles }) {
    const { finalJson, prompt } = buildFinalJSONAndPrompt({ symbol, timeframe, candles });
    // debug log so you can inspect what is sent
    console.log("FINAL JSON sent to Gemini (truncated):", JSON.stringify(finalJson, null, 2).slice(0, 2000));
    const { raw, text } = await sendToGemini(prompt);
    return { finalJson, geminiRaw: raw, geminiText: text };
}

/**
 * runSummaryWithIndicators({symbol, timeframe, indicatorsOverride})
 * - if you compute indicators in backend already, call this with override
 */
async function runSummaryWithIndicators({ symbol, timeframe, indicatorsOverride }) {
    const { finalJson, prompt } = buildFinalJSONAndPrompt({ symbol, timeframe, indicatorsOverride });
    console.log("FINAL JSON sent to Gemini (override):", JSON.stringify(finalJson, null, 2));
    const { raw, text } = await sendToGemini(prompt);
    return { finalJson, geminiRaw: raw, geminiText: text };
}

/* ========== Example test harness (comment/uncomment to run locally) ========== */

/*
(async () => {
  // Example: load candles from a file, DB or API.
  // The sample below demonstrates structure. Replace with real data.

  const sampleCandles = [
    // {t: 0, o: 60, h: 62, l: 58, c: 59, v: 1200}, ...
  ];

  // Option A: If you have candles
  // const res = await runSummary({ symbol: "DASHUSDT", timeframe: "4h", candles: sampleCandles });

  // Option B: If you already computed indicators server-side:
  // const precomputed = { price: 56.3, ema20: 57.1, ema50: 60.0, vwap: 59.6, rsi: 36.5, macd: -3.9, bbSqueeze:0, atr:4.9, obvSeries: [...], avgVol: 1000, prevAvgVol: 1100 };
  // const res = await runSummaryWithIndicators({ symbol: "DASHUSDT", timeframe: "4h", indicatorsOverride: precomputed });

  // console.log("Gemini Text:\n", res.geminiText);
})();
*/

/* ========== Module exports ========== */
export {
    ema, sma, rsi, macd, atr, bollingerBands, vwap, obv, stochastic, williamsR, psar, adx,
    computeTrendBiasFromValues, computeMomentumStateFromValues, computeVolumeContextFromValues, computeVolatilityStateFromValues,
    buildFinalJSONAndPrompt, sendToGemini, runSummary, runSummaryWithIndicators
};
