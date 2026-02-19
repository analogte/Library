"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface VocabGrowthChartProps {
  data: { week: string; total: number }[];
}

export function VocabGrowthChart({ data }: VocabGrowthChartProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">คำศัพท์สะสม</h3>
      <div className="h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="week"
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
            />
            <YAxis
              tick={{ fontSize: 10 }}
              className="fill-muted-foreground"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value) => [`${value} คำ`, "คำศัพท์"]}
            />
            <Line
              type="monotone"
              dataKey="total"
              stroke="hsl(262, 83%, 58%)"
              strokeWidth={2}
              dot={{ fill: "hsl(262, 83%, 58%)", r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
