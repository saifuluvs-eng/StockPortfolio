import React, { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieChartIcon } from "lucide-react";

interface AssetAllocationChartProps {
    positions: any[];
    prices: Record<string, number>;
}

const COLORS = [
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f59e0b", // amber-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
    "#06b6d4", // cyan-500
    "#f43f5e", // rose-500
    "#6366f1", // indigo-500
];

export function AssetAllocationChart({ positions, prices }: AssetAllocationChartProps) {
    const data = useMemo(() => {
        if (!positions || positions.length === 0) return [];

        let totalValue = 0;
        const items = positions.map((p) => {
            const sym = p.symbol.toUpperCase();
            const price = prices[sym] || p.avgPrice || 0;
            const value = (Number(p.qty) || 0) * price;
            totalValue += value;
            return { name: sym, value };
        });

        if (totalValue === 0) return [];

        // Sort by value desc
        items.sort((a, b) => b.value - a.value);

        // Group small items (< 2%) into "Others"
        const threshold = totalValue * 0.02;
        const mainItems = items.filter((i) => i.value >= threshold);
        const smallItems = items.filter((i) => i.value < threshold);

        if (smallItems.length > 0) {
            const othersValue = smallItems.reduce((sum, i) => sum + i.value, 0);
            mainItems.push({ name: "Others", value: othersValue });
        }

        return mainItems;
    }, [positions, prices]);

    if (data.length === 0) {
        return (
            <Card className="dashboard-card h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <PieChartIcon className="w-4 h-4 text-primary" />
                        Asset Allocation
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                    No assets to display
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="dashboard-card h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <PieChartIcon className="w-4 h-4 text-primary" />
                    Asset Allocation
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="h-[180px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                                stroke="none"
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => [`$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, "Value"]}
                                contentStyle={{ backgroundColor: "#1e293b", borderColor: "#334155", color: "#f8fafc" }}
                                itemStyle={{ color: "#f8fafc" }}
                            />
                            <Legend
                                layout="vertical"
                                verticalAlign="middle"
                                align="right"
                                formatter={(value, entry: any) => (
                                    <span className="text-xs text-muted-foreground ml-1">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    );
}
