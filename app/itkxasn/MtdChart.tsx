"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = { day: number; main: number | null; comp: number | null };

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(".", ",") + " M";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(0) + " jt";
  return String(Math.round(n));
}
function fmtFull(v: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(v));
}

export default function MtdChart({
  title,
  data,
  mainLabel,
  compLabel,
}: {
  title: string;
  data: Point[];
  mainLabel: string;
  compLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <p className="text-sm font-semibold text-slate-700 mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 12, fill: "#64748B" }} width={64} />
          <Tooltip
            formatter={(value: number) => (value == null ? "-" : fmtFull(value))}
            labelFormatter={(label) => `Hari ke-${label}`}
          />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line type="monotone" dataKey="main" name={mainLabel} stroke="#2563EB" strokeWidth={2.5} dot={false} />
          <Line
            type="monotone"
            dataKey="comp"
            name={compLabel}
            stroke="#EA580C"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}