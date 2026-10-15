"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Cell,
  Legend,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ScatterPoint = {
  id: string;
  name: string;
  level: string;
  sales: number;
  sol: number;
  durationHours: number;
};

type Metric = "sol" | "duration";
type Plotted = ScatterPoint & { x: number; y: number };

const LEVEL_COLORS: Record<string, string> = { INFINITE: "#2563EB", PLATINUM: "#EA580C" };
const OTHER_COLOR = "#94A3B8";

function fmtShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(".", ",") + " M";
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(0) + " jt";
  return String(Math.round(n));
}
function fmtRp(n: number) {
  return "Rp " + new Intl.NumberFormat("id-ID").format(Math.round(n));
}
function fmtNum(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
}
function fmtDuration(hours: number) {
  const total = Math.round(hours * 3600);
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function PointTooltip({ active, payload }: { active?: boolean; payload?: { payload: Plotted }[] }) {
  if (!active || !payload || payload.length === 0) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-sm px-3 py-2 text-xs">
      <p className="font-semibold text-slate-800">{p.name}</p>
      <p className="text-slate-500 mb-1">
        {p.id} · {p.level}
      </p>
      <p>Sales Volume: {fmtRp(p.sales)}</p>
      <p>SOL / hari: {fmtNum(p.sol)}</p>
      <p>Call Duration / hari: {fmtDuration(p.durationHours)}</p>
    </div>
  );
}

export default function ProductivityScatter({
  points,
  highlightIds,
  excluded,
  monthLabel,
}: {
  points: ScatterPoint[];
  highlightIds: string[] | null;
  excluded: number;
  monthLabel: string;
}) {
  const [metric, setMetric] = useState<Metric>("sol");

  const xOf = (p: ScatterPoint) => (metric === "sol" ? p.sol : p.durationHours);
  const usable: Plotted[] = points.map((p) => ({ ...p, x: xOf(p), y: p.sales })).filter((p) => p.x > 0);

  const avgX = usable.length > 0 ? usable.reduce((a, p) => a + p.x, 0) / usable.length : 0;
  const avgY = usable.length > 0 ? usable.reduce((a, p) => a + p.y, 0) / usable.length : 0;

  const levels = Array.from(new Set(usable.map((p) => p.level))).sort((a, b) => {
    const order = ["INFINITE", "PLATINUM"];
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
  });

  const hl = highlightIds ? new Set(highlightIds) : null;
  const xLabel = metric === "sol" ? "SOL rata-rata per hari" : "Call duration rata-rata per hari (jam)";
  const step = metric === "sol" ? 50 : 0.5;

  // Kandidat coaching: usaha (X) di atas rata-rata, hasil (SV) di bawah rata-rata
  const candidates = usable
    .filter((p) => p.x >= avgX && p.y < avgY)
    .sort((a, b) => a.y - b.y)
    .slice(0, 8);

  const pill = (active: boolean) =>
    `text-sm px-3 py-1.5 rounded-lg border transition ${
      active
        ? "bg-slate-800 text-white border-slate-800"
        : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
    }`;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div>
          <p className="text-sm font-semibold text-slate-700">Scatter Produktivitas Agent — {monthLabel}</p>
          <p className="text-xs text-slate-500">Sumbu Y: total Sales Volume bulan ini</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-slate-600">Sumbu X:</span>
          <button type="button" onClick={() => setMetric("sol")} className={pill(metric === "sol")}>
            SOL
          </button>
          <button type="button" onClick={() => setMetric("duration")} className={pill(metric === "duration")}>
            Call Duration
          </button>
        </div>
      </div>

      {usable.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-10">Belum ada data untuk ditampilkan.</p>
      ) : (
        <ResponsiveContainer width="100%" height={420}>
          <ScatterChart margin={{ top: 10, right: 24, left: 0, bottom: 34 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis
              type="number"
              dataKey="x"
              name={xLabel}
              domain={[
                (min: number) => Math.floor((min * 0.97) / step) * step,
                (max: number) => Math.ceil((max * 1.03) / step) * step,
              ]}
              tickFormatter={(v: number) => (metric === "sol" ? fmtNum(v) : v.toFixed(1).replace(".", ","))}
              tick={{ fontSize: 12, fill: "#64748B" }}
              label={{ value: xLabel, position: "insideBottom", offset: -16, fontSize: 12, fill: "#64748B" }}
            />
            <YAxis
              type="number"
              dataKey="y"
              name="Sales Volume"
              domain={[0, "auto"]}
              tickFormatter={(v: number) => fmtShort(v)}
              tick={{ fontSize: 12, fill: "#64748B" }}
              width={64}
            />
            <ReferenceLine x={avgX} stroke="#94A3B8" strokeDasharray="5 4" />
            <ReferenceLine y={avgY} stroke="#94A3B8" strokeDasharray="5 4" />
            <Tooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={({ active, payload }) => (
                <PointTooltip active={active} payload={payload as unknown as { payload: Plotted }[] | undefined} />
              )}
            />
            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: 12, paddingBottom: 8 }} />
            {levels.map((lv) => {
              const color = LEVEL_COLORS[lv] ?? OTHER_COLOR;
              const data = usable.filter((p) => p.level === lv);
              return (
                <Scatter key={lv} name={lv} data={data} fill={color}>
                  {data.map((d) => (
                    <Cell key={d.id} fill={color} fillOpacity={hl && !hl.has(d.id) ? 0.15 : 0.85} />
                  ))}
                </Scatter>
              );
            })}
          </ScatterChart>
        </ResponsiveContainer>
      )}

      <div className="mt-3 text-xs text-slate-500 space-y-1">
        <p>
          Garis putus-putus = rata-rata seluruh agent. <strong>Kanan-bawah</strong>: usaha tinggi tapi SV rendah
          (kandidat coaching). <strong>Kiri-atas</strong>: usaha lebih ringan tapi SV tinggi (efisien).
        </p>
        {highlightIds && <p>Kolom pencarian di atas menyorot agent yang cocok, agent lain dibuat samar.</p>}
        {excluded > 0 && <p>{excluded} agent tanpa data call duration tidak ditampilkan.</p>}
        {candidates.length > 0 && (
          <p className="text-slate-600">
            <strong>Kandidat coaching:</strong>{" "}
            {candidates.map((c) => `${c.name} (${fmtShort(c.y)})`).join(", ")}
          </p>
        )}
      </div>
    </div>
  );
}