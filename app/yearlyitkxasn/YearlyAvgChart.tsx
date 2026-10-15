"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = { label: string; itkAvg: number; asnAvg: number };

function fmtFull(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export default function YearlyAvgChart({ data }: { data: Row[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <p className="text-sm font-semibold text-slate-700 mb-3">Rata-rata SV per Agent: ITK vs ASN</p>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }} barGap={4}>
          <CartesianGrid strokeDasharray="1 3" vertical={false} stroke="#CBD5E1" />
          <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#475569", fontWeight: 600 }} />
          <YAxis
            tickFormatter={(v: number) => (v === 0 ? "-" : fmtFull(v))}
            tick={{ fontSize: 12, fill: "#64748B" }}
            width={96}
          />
          <Tooltip formatter={(value: number) => "Rp " + fmtFull(value)} />
          <Legend verticalAlign="top" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
          <Bar dataKey="itkAvg" name="AVERAGE SV / AGENT ITK" fill="#155E75" radius={[2, 2, 0, 0]} />
          <Bar dataKey="asnAvg" name="AVERAGE SV / AGENT ASN" fill="#EA580C" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}