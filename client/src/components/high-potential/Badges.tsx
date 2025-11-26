import React from "react";

export function TrendBadge({ score }: { score: number }) {
    if (score >= 8) return <span><span className="text-[#0f0]">🟢</span> <span className="text-white font-medium">Strong Trend</span></span>;
    if (score >= 6) return <span><span className="text-[#4aff4a]">🟩</span> <span className="text-white font-medium">Trend Strong</span></span>;
    if (score >= 5) return <span><span className="text-[#ffff55]">🟨</span> <span className="text-white font-medium">Trend Forming</span></span>;
    return <span><span className="text-[#999]">⚪</span> <span className="text-white font-medium">Weak Trend</span></span>;
}

export function MomentumBadge({ rsi }: { rsi: number }) {
    if (rsi >= 55 && rsi <= 65) return <span><span className="text-[#0f0]">🟢</span> <span className="text-white font-medium">Momentum Rising</span></span>;
    if (rsi >= 48) return <span><span className="text-[#4aff4a]">🟩</span> <span className="text-white font-medium">Healthy Momentum</span></span>;
    return <span><span className="text-[#999]">⚪</span> <span className="text-white font-medium">Momentum Neutral</span></span>;
}

export function VolumeBadge({ volume, avgVolume }: { volume: number; avgVolume: number }) {
    if (volume > avgVolume * 1.5) return <span><span className="text-[#0f0]">🟢</span> <span className="text-white font-medium">Strong Volume</span></span>;
    if (volume > avgVolume) return <span><span className="text-[#4aff4a]">🟩</span> <span className="text-white font-medium">Volume Rising</span></span>;
    return <span><span className="text-[#999]">⚪</span> <span className="text-white font-medium">Neutral Volume</span></span>;
}

export function VolatilityBadge({ state }: { state: string }) {
    if (state === "high") return <span><span className="text-[#c084fc]">🟣</span> <span className="text-white font-medium">Volatility Expanding</span></span>;
    if (state === "normal") return <span><span className="text-white">⚪</span> <span className="text-white font-medium">Normal Volatility</span></span>;
    return <span><span className="text-[#60a5fa]">🔵</span> <span className="text-white font-medium">Compression</span></span>;
}
