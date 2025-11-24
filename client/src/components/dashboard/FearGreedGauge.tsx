import React from "react";

interface FearGreedGaugeProps {
  value: number; // 0-100
  classification: string;
}

export const FearGreedGauge: React.FC<FearGreedGaugeProps> = ({ value, classification }) => {
  // Clamp value between 0-100
  const clampedValue = Math.max(0, Math.min(100, value));
  
  // Calculate rotation: -90deg (0 fear) to 90deg (100 greed)
  const rotation = -90 + (clampedValue / 100) * 180;
  
  // Determine color based on value
  let needleColor = "#ef4444"; // red for extreme fear
  let gaugeSectionColor = "#ef4444";
  
  if (clampedValue < 25) {
    needleColor = "#ef4444"; // red - extreme fear
    gaugeSectionColor = "#dc2626";
  } else if (clampedValue < 45) {
    needleColor = "#f97316"; // orange - fear
    gaugeSectionColor = "#ea580c";
  } else if (clampedValue < 55) {
    needleColor = "#eab308"; // yellow - neutral
    gaugeSectionColor = "#ca8a04";
  } else if (clampedValue < 75) {
    needleColor = "#84cc16"; // lime - greed
    gaugeSectionColor = "#65a30d";
  } else {
    needleColor = "#22c55e"; // green - extreme greed
    gaugeSectionColor = "#16a34a";
  }

  return (
    <div className="flex flex-col items-center justify-center w-full">
      {/* SVG Gauge */}
      <svg width="200" height="120" viewBox="0 0 200 120" className="mb-4">
        {/* Background gauge arc */}
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" style={{ stopColor: "#ef4444", stopOpacity: 1 }} /> {/* Red - Fear */}
            <stop offset="25%" style={{ stopColor: "#f97316", stopOpacity: 1 }} /> {/* Orange */}
            <stop offset="50%" style={{ stopColor: "#eab308", stopOpacity: 1 }} /> {/* Yellow */}
            <stop offset="75%" style={{ stopColor: "#84cc16", stopOpacity: 1 }} /> {/* Lime */}
            <stop offset="100%" style={{ stopColor: "#22c55e", stopOpacity: 1 }} /> {/* Green - Greed */}
          </linearGradient>
        </defs>

        {/* Main gauge arc - colored gradient */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Gauge markers */}
        <text x="20" y="115" fontSize="10" fill="currentColor" className="text-muted-foreground" textAnchor="middle">
          Fear
        </text>
        <text x="100" y="115" fontSize="10" fill="currentColor" className="text-muted-foreground" textAnchor="middle">
          Neutral
        </text>
        <text x="180" y="115" fontSize="10" fill="currentColor" className="text-muted-foreground" textAnchor="middle">
          Greed
        </text>

        {/* Needle pivot circle */}
        <circle cx="100" cy="100" r="8" fill="currentColor" className="text-foreground" />

        {/* Needle */}
        <g transform={`rotate(${rotation} 100 100)`}>
          <line x1="100" y1="100" x2="100" y2="25" stroke={needleColor} strokeWidth="3" strokeLinecap="round" />
          {/* Needle tip circle */}
          <circle cx="100" cy="25" r="4" fill={needleColor} />
        </g>
      </svg>

      {/* Value Display */}
      <div className="text-center">
        <div className="text-3xl font-bold" style={{ color: needleColor }}>
          {clampedValue.toFixed(0)}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{classification}</div>
      </div>
    </div>
  );
};
