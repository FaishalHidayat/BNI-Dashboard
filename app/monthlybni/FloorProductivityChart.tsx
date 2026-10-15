"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

type Row = { category: string; [key: string]: number | string };

const PALETTE = ["#2563EB", "#F97316", "#94A3B8", "#16A34A", "#DC2626", "#7C3AED", "#0D9488", "#CA8A04"];

export default function FloorProductivityChart({
  title,
  data,
  monthLabels,
}: {
  title: string;
  data: Row[];
  monthLabels: string[];
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700 mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 20, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="category" tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748B" }} width={30} />
          <Tooltip />
          <Legend />
          {monthLabels.map((m, i) => (
            <Bar key={m} dataKey={m} name={m} fill={PALETTE[i % PALETTE.length]} radius={[3, 3, 0, 0]}>
              <LabelList dataKey={m} position="top" style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }} />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}