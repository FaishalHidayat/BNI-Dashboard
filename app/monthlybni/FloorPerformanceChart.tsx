"use client";

import {
  Bar,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts";

type ChartRow = {
  month: string;
  monthLabel: string;
  salesVolume: number;
  avgDurationSeconds: number;
  avgDurationLabel: string;
};

function fmtRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
}

export default function FloorPerformanceChart({ data }: { data: ChartRow[] }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 mb-6">
      <p className="text-sm font-semibold text-slate-700 mb-3">Floor Performance</p>
      <ResponsiveContainer width="100%" height={360}>
        <ComposedChart data={data} margin={{ top: 30, right: 24, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
          <XAxis dataKey="monthLabel" tick={{ fontSize: 12, fill: "#64748B" }} />
          <YAxis yAxisId="left" tickFormatter={(v) => fmtRp(v)} tick={{ fontSize: 11, fill: "#64748B" }} width={90} />
          <YAxis yAxisId="right" hide domain={["dataMin - 3600", "dataMax + 3600"]} />
          <Tooltip
            formatter={(value: number, name: string) =>
              name === "Sales Volume" ? fmtRp(value) : formatDuration(value)
            }
          />
          <Legend />
          <Bar yAxisId="left" dataKey="salesVolume" name="Sales Volume" fill="#0F1F4B" radius={[4, 4, 0, 0]} barSize={70}>
            <LabelList
              dataKey="salesVolume"
              position="top"
              formatter={(v: number) => new Intl.NumberFormat("id-ID").format(v)}
              style={{ fontSize: 11, fill: "#334155", fontWeight: 600 }}
            />
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avgDurationSeconds"
            name="Call Duration"
            stroke="#94A3B8"
            strokeWidth={2}
            dot={{ r: 4, fill: "#94A3B8" }}
          >
            <LabelList
              dataKey="avgDurationLabel"
              position="top"
              style={{ fontSize: 11, fill: "#475569" }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function formatDuration(totalSeconds: number) {
  const sec = Math.round(totalSeconds);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}