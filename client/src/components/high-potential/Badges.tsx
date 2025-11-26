import React from "react";

export function TrendBadge({ score }: { score: number }) {
    if (score >= 8) return <span className="text-[#0f0] font-medium">🟢 Strong Trend</span>;
    if (score >= 6) return <span className="text-[#4aff4a] font-medium">🟩 Trend Strong</span>;
    if (score >= 5) return <span className="text-[#ffff55] font-medium">🟨 Trend Forming</span>;
    return <span className="text-[#999] font-medium">⚪ Weak Trend</span>;
}

export function MomentumBadge({ rsi }: { rsi: number }) {
    if (rsi >= 55 && rsi <= 65) return <span className="text-[#0f0] font-medium">🟢 Momentum Rising</span>;
    if (rsi >= 48) return <span className="text-[#4aff4a] font-medium">🟩 Healthy Momentum</span>;
    return <span className="text-[#999] font-medium">⚪ Momentum Neutral</span>;
}

export function VolumeBadge({ volume, avgVolume }: { volume: number; avgVolume: number }) {
    if (volume > avgVolume * 1.5) return <span className="text-[#0f0] font-medium">🟢 Strong Volume</span>;
    if (volume > avgVolume) return <span className="text-[#4aff4a] font-medium">🟩 Volume Rising</span>;
    return <span className="text-[#999] font-medium">⚪ Neutral Volume</span>;
}

export function VolatilityBadge({ state }: { state: string }) {
    if (state === "high") return <span className="text-[#c084fc] font-medium">🟣 Volatility Expanding</span>;
    if (state === "normal") return <span className="text-white font-medium">⚪ Normal Volatility</span>;
    return <span className="text-[#60a5fa] font-medium">🔵 Compression</span>;
}
