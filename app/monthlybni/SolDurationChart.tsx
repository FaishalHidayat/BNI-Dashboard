"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

type Row = { monthLabel: string; ge: number; lt: number };

export default function SolDurationChart({
  title,
  data,
  geLabel,
  ltLabel,
}: {
  title: string;
  data: Row[];
  geLabel: string;
  ltLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <p className="text-sm font-semibold text-slate-700 mb-3 text-center">{title}</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748B" }} width={30} />
          <Tooltip />
          <Legend />
          <Bar dataKey="ge" name={geLabel} stackId="a" fill="#0F1F4B">
            <LabelList dataKey="ge" position="center" style={{ fontSize: 12, fill: "#FFFFFF", fontWeight: 600 }} />
          </Bar>
          <Bar dataKey="lt" name={ltLabel} stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]}>
            <LabelList
              dataKey="lt"
              position="center"
              formatter={(v: number) => (v > 0 ? v : "")}
              style={{ fontSize: 12, fill: "#FFFFFF", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}