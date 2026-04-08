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

type Point = { id: string; score: number; label: string };

export function RiskTrendChart({ data }: { data: Point[] }) {
  if (!data.length) {
    return (
      <p className="text-sm text-zinc-500">Run a scan to populate risk trends.</p>
    );
  }
  const chartData = [...data].reverse().map((d, i) => ({
    name: `#${i + 1}`,
    score: d.score,
    label: d.label,
  }));
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
          <XAxis dataKey="name" stroke="#71717a" fontSize={12} />
          <YAxis domain={[0, 100]} stroke="#71717a" fontSize={12} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #3f3f46",
              borderRadius: 8,
            }}
            labelStyle={{ color: "#a1a1aa" }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
