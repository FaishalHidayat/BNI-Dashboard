"use client";

import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; sales: number };

function fmtShort(n: number, decimals = 0) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(decimals).replace(".", ",") + " M";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(decimals).replace(".", ",") + " jt";
  return String(n);
}

export default function MonthlySvChart({ data }: { data: Row[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <p className="text-sm font-semibold text-slate-700 mb-3">Month to Month Sales Volume</p>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 24, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis tickFormatter={(v: number) => fmtShort(v)} tick={{ fontSize: 12, fill: "#64748B" }} width={60} />
          <Tooltip
            formatter={(value: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value))}
          />
          <Bar dataKey="sales" name="Sales Volume" fill="#2563EB" radius={[3, 3, 0, 0]} maxBarSize={80}>
            <LabelList
              dataKey="sales"
              position="top"
              formatter={(v: number) => fmtShort(v, 1)}
              style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}