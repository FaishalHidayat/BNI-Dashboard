import { Fragment } from "react";
import { prisma } from "../lib/prisma";

const REPORT_TYPE = "QC_CLOS";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
}
function fmtRp(n: number | null | undefined) {
  return "Rp " + fmt(n);
}
function toMonthStart(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
function addDaysUTC(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}
function dateLabelShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

type SortKey = "name" | "spvName" | "rCard" | "rFreq" | "rSales" | "mCard" | "mFreq" | "mSales";
type Row = {
  level: string | null;
  spvName: string;
  userId: string;
  name: string;
  rCard: number;
  rFreq: number;
  rSales: number;
  mCard: number;
  mFreq: number;
  mSales: number;
};

const SORT_LABELS: Record<SortKey, string> = {
  name: "Name",
  spvName: "SPV Name",
  rCard: "Card (Periode)",
  rFreq: "Freq (Periode)",
  rSales: "Sales Volume (Periode)",
  mCard: "Card (Bulan)",
  mFreq: "Freq (Bulan)",
  mSales: "Sales Volume (Bulan)",
};

function compareMulti(a: Row, b: Row, keys: SortKey[], dirs: ("asc" | "desc")[]) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const d = dirs[i] ?? "desc";
    const va = a[k];
    const vb = b[k];
    let cmp: number;
    if (typeof va === "string" && typeof vb === "string") {
      cmp = va.localeCompare(vb);
    } else {
      cmp = Number(va ?? 0) - Number(vb ?? 0);
    }
    if (d === "desc") cmp = -cmp;
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;

  let startDate = params.start;
  let endDate = params.end;
  const q = (params.q ?? "").trim().toLowerCase();
  const sortKeys = (params.sort ? params.sort.split(",").filter(Boolean) : []) as SortKey[];
  const sortDirs = (params.dir ? params.dir.split(",") : []) as ("asc" | "desc")[];

  if (!startDate || !endDate) {
    const latest = await prisma.ag_daily.aggregate({ where: { report_type: REPORT_TYPE }, _max: { report_date: true } });
    const latestStr = latest._max.report_date ? latest._max.report_date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    startDate = startDate ?? latestStr;
    endDate = endDate ?? latestStr;
  }
  if (new Date(endDate) < new Date(startDate)) {
    [startDate, endDate] = [endDate, startDate];
  }

  const monthStart = toMonthStart(startDate);
  const monthEnd = addDaysUTC(monthStart.toISOString().slice(0, 10), 32);
  monthEnd.setUTCDate(1);
  const rangeEndExclusive = addDaysUTC(endDate, 1);

  const mappings = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart },
    include: { agent: true },
    orderBy: [{ spv_name: "asc" }, { user_id4: "asc" }],
  });

  const rangeAgg = await prisma.ag_daily.groupBy({
    by: ["user_id"],
    where: { report_type: REPORT_TYPE, report_date: { gte: new Date(startDate), lt: rangeEndExclusive } },
    _sum: { card_count: true, freq: true, sales_volume: true },
  });
  const rangeMap = new Map(rangeAgg.map((r) => [r.user_id, r._sum]));

  const monthlyAgg = await prisma.ag_daily.groupBy({
    by: ["user_id"],
    where: { report_type: REPORT_TYPE, report_date: { gte: monthStart, lt: monthEnd } },
    _sum: { card_count: true, freq: true, sales_volume: true },
  });
  const monthlyMap = new Map(monthlyAgg.map((r) => [r.user_id, r._sum]));

  const allRows: Row[] = mappings.map((m) => {
    const range = rangeMap.get(m.user_id4);
    const monthly = monthlyMap.get(m.user_id4);
    return {
      level: m.level,
      spvName: m.spv_name,
      userId: m.user_id4,
      name: m.agent.user_name,
      rCard: range?.card_count ?? 0,
      rFreq: range?.freq ?? 0,
      rSales: Number(range?.sales_volume ?? 0),
      mCard: monthly?.card_count ?? 0,
      mFreq: monthly?.freq ?? 0,
      mSales: Number(monthly?.sales_volume ?? 0),
    };
  });

  // Kalau ketik nama agent ATAU nama SPV yang cocok, agent tsb tetap tampil
  // (jadi cari nama SPV otomatis menampilkan seluruh tim SPV itu, subtotal-nya utuh)
  const filteredRows = q
    ? allRows.filter((r) => (r.name ?? "").toLowerCase().includes(q) || (r.spvName ?? "").toLowerCase().includes(q))
    : allRows;

  const grouped = new Map<string, Row[]>();
  for (const r of filteredRows) {
    if (!grouped.has(r.spvName)) grouped.set(r.spvName, []);
    grouped.get(r.spvName)!.push(r);
  }
  // Terapkan multi-sort DI DALAM tiap grup, supaya subtotal per SPV tetap utuh
  if (sortKeys.length > 0) {
    for (const agents of grouped.values()) {
      agents.sort((a, b) => compareMulti(a, b, sortKeys, sortDirs));
    }
  }

  const zero = { rCard: 0, rFreq: 0, rSales: 0, mCard: 0, mFreq: 0, mSales: 0 };
  const grandTotal = filteredRows.reduce(
    (acc, r) => ({
      rCard: acc.rCard + r.rCard,
      rFreq: acc.rFreq + r.rFreq,
      rSales: acc.rSales + r.rSales,
      mCard: acc.mCard + r.mCard,
      mFreq: acc.mFreq + r.mFreq,
      mSales: acc.mSales + r.mSales,
    }),
    zero
  );

  const isSingleDay = startDate === endDate;
  const periodLabel = isSingleDay ? dateLabelShort(startDate) : `${dateLabelShort(startDate)} – ${dateLabelShort(endDate)}`;

  const kpiCards = [
    { label: `Total Card (${periodLabel})`, value: fmt(grandTotal.rCard) },
    { label: `Total Freq (${periodLabel})`, value: fmt(grandTotal.rFreq) },
    { label: `Sales Volume (${periodLabel})`, value: fmtRp(grandTotal.rSales) },
    { label: "Sales Volume (Bulan Penuh)", value: fmtRp(grandTotal.mSales) },
  ];

  // Header kolom yang bisa diklik: klik = tambah/toggle arah kolom itu di daftar sort aktif
  function sortLink(key: SortKey, label: string) {
    const idx = sortKeys.indexOf(key);
    const newKeys = [...sortKeys];
    const newDirs = [...sortDirs];
    if (idx === -1) {
      newKeys.push(key);
      newDirs.push("desc");
    } else {
      newDirs[idx] = newDirs[idx] === "desc" ? "asc" : "desc";
    }
    const qs = new URLSearchParams();
    qs.set("start", startDate!);
    qs.set("end", endDate!);
    if (q) qs.set("q", q);
    qs.set("sort", newKeys.join(","));
    qs.set("dir", newDirs.join(","));

    const activeIdx = sortKeys.indexOf(key);
    const arrow = activeIdx === -1 ? "" : sortDirs[activeIdx] === "desc" ? " ▼" : " ▲";
    const order = activeIdx === -1 ? "" : ` (${activeIdx + 1})`;

    return (
      <a href={`/?${qs.toString()}`} className="hover:underline">
        {label}
        {arrow}
        {order}
      </a>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">AGENT BNI</h1>
            <p className="text-slate-500 text-sm">
              Data QC_CLOS — Periode {periodLabel} · Bulan {monthLabel(startDate)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {kpiCards.map((kpi) => (
            <div key={kpi.label} className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
              <p className="text-xs text-slate-500 mb-1">{kpi.label}</p>
              <p className="text-lg font-bold text-slate-800">{kpi.value}</p>
            </div>
          ))}
        </div>

        <form method="GET" className="mb-2 flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit">
          <label htmlFor="start" className="text-sm text-slate-600">Dari:</label>
          <input type="date" id="start" name="start" defaultValue={startDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="end" className="text-sm text-slate-600">Sampai:</label>
          <input type="date" id="end" name="end" defaultValue={endDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="q" className="text-sm text-slate-600 ml-2">Cari Nama/SPV:</label>
          <input
            type="text"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Ketik nama agent atau SPV..."
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56"
          />
          {sortKeys.length > 0 && <input type="hidden" name="sort" value={sortKeys.join(",")} />}
          {sortDirs.length > 0 && <input type="hidden" name="dir" value={sortDirs.join(",")} />}
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
          {(q || sortKeys.length > 0) && (
            <a href={`/?start=${startDate}&end=${endDate}`} className="text-xs text-blue-600 hover:underline ml-1">
              Reset filter/sort
            </a>
          )}
        </form>

        {sortKeys.length > 0 && (
          <p className="text-xs text-slate-500 mb-4">
            Diurutkan berdasarkan: {sortKeys.map((k, i) => `${SORT_LABELS[k]} (${sortDirs[i] === "asc" ? "kecil→besar" : "besar→kecil"})`).join(" → ")}
          </p>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[900px]">
            <thead className="bg-slate-800 text-white sticky top-0">
              <tr>
                <th className="p-3 text-left font-medium">Level</th>
                <th className="p-3 text-left font-medium">{sortLink("spvName", "SPV Name")}</th>
                <th className="p-3 text-left font-medium">User ID</th>
                <th className="p-3 text-left font-medium">{sortLink("name", "Name")}</th>
                <th className="p-3 text-right font-medium">{sortLink("rCard", `Card (${periodLabel})`)}</th>
                <th className="p-3 text-right font-medium">{sortLink("rFreq", `Freq (${periodLabel})`)}</th>
                <th className="p-3 text-right font-medium">{sortLink("rSales", `Sales Volume (${periodLabel})`)}</th>
                <th className="p-3 text-right font-medium">{sortLink("mCard", "Card (Bulan)")}</th>
                <th className="p-3 text-right font-medium">{sortLink("mFreq", "Freq (Bulan)")}</th>
                <th className="p-3 text-right font-medium">{sortLink("mSales", "Sales Volume (Bulan)")}</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([spvName, agents]) => {
                const subtotal = agents.reduce(
                  (acc, r) => ({
                    rCard: acc.rCard + r.rCard,
                    rFreq: acc.rFreq + r.rFreq,
                    rSales: acc.rSales + r.rSales,
                    mCard: acc.mCard + r.mCard,
                    mFreq: acc.mFreq + r.mFreq,
                    mSales: acc.mSales + r.mSales,
                  }),
                  zero
                );
                const level = agents[0]?.level ?? "";
                return (
                  <Fragment key={spvName}>
                    <tr className="bg-blue-50">
                      <td colSpan={10} className="p-2 px-3 font-semibold text-blue-900 text-xs uppercase tracking-wide">
                        {level} · {spvName}
                      </td>
                    </tr>
                    {agents.map((r, idx) => (
                      <tr key={r.userId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2.5 pl-6 text-slate-500">{r.level}</td>
                        <td className="p-2.5 text-slate-500">{r.spvName}</td>
                        <td className="p-2.5 font-mono text-xs text-slate-600">{r.userId}</td>
                        <td className="p-2.5 text-slate-800">{r.name}</td>
                        <td className="p-2.5 text-right tabular-nums">{fmt(r.rCard)}</td>
                        <td className="p-2.5 text-right tabular-nums">{fmt(r.rFreq)}</td>
                        <td className="p-2.5 text-right tabular-nums">{fmtRp(r.rSales)}</td>
                        <td className="p-2.5 text-right tabular-nums">{fmt(r.mCard)}</td>
                        <td className="p-2.5 text-right tabular-nums">{fmt(r.mFreq)}</td>
                        <td className="p-2.5 text-right tabular-nums">{fmtRp(r.mSales)}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold border-t border-slate-200">
                      <td className="p-2.5" colSpan={4}>Subtotal — {spvName}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(subtotal.rCard)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(subtotal.rFreq)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtRp(subtotal.rSales)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(subtotal.mCard)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(subtotal.mFreq)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtRp(subtotal.mSales)}</td>
                    </tr>
                  </Fragment>
                );
              })}
              {grouped.size === 0 && (
                <tr>
                  <td colSpan={10} className="p-4 text-center text-slate-400">Tidak ada agent/SPV yang cocok.</td>
                </tr>
              )}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="p-3" colSpan={4}>TOTAL KESELURUHAN</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.rCard)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.rFreq)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.rSales)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.mCard)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.mFreq)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.mSales)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}