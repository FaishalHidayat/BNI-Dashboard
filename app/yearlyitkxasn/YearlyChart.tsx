"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; itk: number; asn: number };

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(0) + " M";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(0) + " jt";
  return String(n);
}

export default function YearlyChart({ data }: { data: Row[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <p className="text-sm font-semibold text-slate-700 mb-3">Sales Volume ITK vs ASN per Bulan</p>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis tickFormatter={fmtShort} tick={{ fontSize: 12, fill: "#64748B" }} width={60} />
          <Tooltip
            formatter={(value: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value))}
          />
          <Legend />
          <Bar dataKey="itk" name="Intikom" fill="#2563EB" radius={[3, 3, 0, 0]} />
          <Bar dataKey="asn" name="Asianindo" fill="#EA580C" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}