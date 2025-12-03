import React, { useMemo } from 'react';
import {
    ComposedChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    ReferenceArea,
    Bar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface RsiDataPoint {
    symbol: string;
    rsi: Record<string, number>;
    price: number;
    change: number;
}

interface RsiHeatmapProps {
    data: RsiDataPoint[];
    isLoading: boolean;
}

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload;
        const rsiValues = data.rsi || {};

        return (
            <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg shadow-xl">
                <p className="font-bold text-white mb-2">{label}</p>
                <div className="space-y-1">
                    {Object.entries(rsiValues).map(([tf, val]: [string, any]) => (
                        <div key={tf} className="flex items-center justify-between gap-4 text-xs">
                            <span className="text-zinc-400">RSI ({tf}):</span>
                            <span className={`font-mono font-medium ${val >= 70 ? 'text-red-400' :
                                val <= 30 ? 'text-emerald-400' : 'text-white'
                                }`}>
                                {val}
                            </span>
                        </div>
                    ))}
                    <div className="h-px bg-zinc-800 my-2" />
                    <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-zinc-400">Price:</span>
                        <span className="text-white font-mono">${data.price}</span>
                    </div>
                    <div className="flex items-center justify-between gap-4 text-xs">
                        <span className="text-zinc-400">24h Change:</span>
                        <span className={`font-mono ${data.change >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {data.change > 0 ? '+' : ''}{data.change}%
                        </span>
                    </div>
                </div>
            </div>
        );
    }
    return null;
};

export function RsiHeatmap({ data, isLoading }: RsiHeatmapProps) {
    // Process data to find max RSI for the stem and flatten for chart if needed
    // The API now returns rsi as an object: { "15m": 30, "1h": 45 }
    const processedData = useMemo(() => {
        return data.map(item => {
            const rsiValues = Object.values(item.rsi || {});
            const maxRsi = Math.max(...rsiValues, 0);
            return {
                ...item,
                maxRsi, // For the stem height
            };
        });
    }, [data]);

    // Get all available timeframe keys from the first item (assuming consistent data)
    const timeframeKeys = useMemo(() => {
        if (!data.length || !data[0].rsi) return [];
        return Object.keys(data[0].rsi);
    }, [data]);

    if (isLoading) {
        return (
            <Card className="w-full h-[600px] bg-zinc-950 border-zinc-800">
                <CardHeader>
                    <CardTitle>Crypto Market RSI Heatmap</CardTitle>
                </CardHeader>
                <CardContent className="h-[500px] flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <p className="text-zinc-500">Scanning market data...</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="w-full bg-zinc-950 border-zinc-800">
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-xl font-bold text-white">Crypto Market RSI Heatmap</CardTitle>
                <div className="flex gap-2">
                    <Badge variant="outline" className="bg-red-900/20 text-red-400 border-red-900/50">Overbought &gt;70</Badge>
                    <Badge variant="outline" className="bg-emerald-900/20 text-emerald-400 border-emerald-900/50">Oversold &lt;30</Badge>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[600px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={processedData}
                            margin={{ top: 20, right: 20, bottom: 60, left: 20 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                            <XAxis
                                dataKey="symbol"
                                angle={-90}
                                textAnchor="end"
                                interval={0}
                                tick={{ fill: '#666', fontSize: 10 }}
                                height={60}
                            />
                            <YAxis
                                domain={[0, 100]}
                                ticks={[0, 30, 40, 50, 60, 70, 100]}
                                tick={{ fill: '#888' }}
                            />
                            <Tooltip content={<CustomTooltip />} />

                            {/* Zones Backgrounds */}
                            <ReferenceArea y1={70} y2={100} fill="#ef4444" fillOpacity={0.1} label={{ value: "OVERBOUGHT", position: 'insideTopRight', fill: '#ef4444', fontSize: 12 }} />
                            <ReferenceArea y1={60} y2={70} fill="#f87171" fillOpacity={0.05} label={{ value: "STRONG", position: 'insideRight', fill: '#f87171', fontSize: 12 }} />
                            <ReferenceArea y1={40} y2={60} fill="#71717a" fillOpacity={0.05} label={{ value: "NEUTRAL", position: 'insideRight', fill: '#71717a', fontSize: 12 }} />
                            <ReferenceArea y1={30} y2={40} fill="#34d399" fillOpacity={0.05} label={{ value: "WEAK", position: 'insideRight', fill: '#34d399', fontSize: 12 }} />
                            <ReferenceArea y1={0} y2={30} fill="#10b981" fillOpacity={0.1} label={{ value: "OVERSOLD", position: 'insideBottomRight', fill: '#10b981', fontSize: 12 }} />

                            {/* Stems (Lollipop stick) - goes up to the highest RSI value */}
                            <Bar dataKey="maxRsi" barSize={2} fill="#3f3f46" isAnimationActive={false} />

                            {/* Data Points (Lollipop heads) - One for each timeframe */}
                            {timeframeKeys.map((tf) => (
                                <Line
                                    key={tf}
                                    dataKey={`rsi.${tf}`}
                                    stroke="none"
                                    isAnimationActive={false}
                                    dot={(props: any) => {
                                        const { cx, cy, payload } = props;
                                        const val = payload.rsi?.[tf];
                                        if (val === undefined) return <></>; // Skip if no data for this TF

                                        let color = '#9ca3af'; // neutral
                                        if (val >= 70) color = '#ef4444';
                                        else if (val >= 60) color = '#f87171';
                                        else if (val <= 30) color = '#10b981';
                                        else if (val <= 40) color = '#34d399';

                                        // Make dots slightly transparent if multiple to see overlaps better? 
                                        // Or just solid. Solid is usually clearer.
                                        return (
                                            <circle cx={cx} cy={cy} r={4} fill={color} stroke="white" strokeWidth={1} />
                                        );
                                    }}
                                />
                            ))}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
