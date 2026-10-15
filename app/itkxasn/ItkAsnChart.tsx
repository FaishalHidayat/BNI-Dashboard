"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

type ChartRow = {
  date: string; // YYYY-MM-DD
  itkAvg: number;
  asnAvg: number;
};

function formatDateShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

function formatRupiahShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "M";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(0) + "jt";
  return new Intl.NumberFormat("id-ID").format(n);
}

export default function ItkAsnChart({ data, title = "Rata-rata Agent" }: { data: ChartRow[]; title?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <p className="text-sm font-semibold text-slate-700 mb-3">{title}</p>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ top: 10, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="date" tickFormatter={formatDateShort} tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis tickFormatter={formatRupiahShort} tick={{ fontSize: 12, fill: "#64748B" }} width={70} />
          <Tooltip
            formatter={(value: number) => "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(value))}
            labelFormatter={(label: string) => formatDateShort(label)}
          />
          <Legend />
          <Line type="monotone" dataKey="itkAvg" name="ITK" stroke="#2563EB" strokeWidth={2} dot={false} />
          <Line type="monotone" dataKey="asnAvg" name="ASN" stroke="#EA580C" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}