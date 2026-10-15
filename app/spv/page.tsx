import { prisma } from "../../lib/prisma";
import HideCekToggle from "./HideCekToggle";

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
function nextMonthStart(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
function dateLabelShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}

type SortKey = "spvName" | "pCard" | "pFreq" | "pSales" | "mCard" | "mFreq" | "mSales";
type Row = {
  level: string;
  spvName: string | null;
  userId: string;
  pCard: number;
  pFreq: number;
  pSales: number;
  mCard: number;
  mFreq: number;
  mSales: number;
  teamSales: number;
  diff: number;
};

const SORT_LABELS: Record<SortKey, string> = {
  spvName: "SPV Name",
  pCard: "Card (Periode)",
  pFreq: "Freq (Periode)",
  pSales: "Sales Volume (Periode)",
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

export default async function SpvPage({
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
    const latest = await prisma.spv_daily.aggregate({
      where: { report_type2: REPORT_TYPE },
      _max: { report_date2: true },
    });
    const latestStr = latest._max.report_date2 ? latest._max.report_date2.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    startDate = startDate ?? latestStr;
    endDate = endDate ?? latestStr;
  }
  if (new Date(endDate) < new Date(startDate)) {
    [startDate, endDate] = [endDate, startDate];
  }

  const monthStart = toMonthStart(startDate);
  const monthEnd = nextMonthStart(startDate);
  const rangeEndExclusive = addDaysUTC(endDate, 1);

  const masterList = await prisma.spv_daily.findMany({
    where: { report_type2: REPORT_TYPE, report_date2: { gte: monthStart, lt: monthEnd } },
    distinct: ["user_id2"],
    select: { user_id2: true, user_name2: true },
  });

  const spvLevelRows = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart, spv_user_id: { in: masterList.map((m) => m.user_id2) } },
    distinct: ["spv_user_id"],
    select: { spv_user_id: true, level: true },
  });
  const levelMap = new Map(spvLevelRows.map((r) => [r.spv_user_id, r.level]));

  const periodAgg = await prisma.spv_daily.groupBy({
    by: ["user_id2"],
    where: { report_type2: REPORT_TYPE, report_date2: { gte: new Date(startDate), lt: rangeEndExclusive } },
    _sum: { card_count2: true, freq2: true, sales_volume2: true },
  });
  const periodMap = new Map(periodAgg.map((r) => [r.user_id2, r._sum]));

  const monthlyAgg = await prisma.spv_daily.groupBy({
    by: ["user_id2"],
    where: { report_type2: REPORT_TYPE, report_date2: { gte: monthStart, lt: monthEnd } },
    _sum: { card_count2: true, freq2: true, sales_volume2: true },
  });
  const monthlyMap = new Map(monthlyAgg.map((r) => [r.user_id2, r._sum]));

  const mappings = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart },
    select: { user_id4: true, spv_user_id: true },
  });
  const agentPeriodAgg = await prisma.ag_daily.groupBy({
    by: ["user_id"],
    where: { report_type: REPORT_TYPE, report_date: { gte: new Date(startDate), lt: rangeEndExclusive } },
    _sum: { sales_volume: true },
  });
  const agentSalesMap = new Map(agentPeriodAgg.map((r) => [r.user_id, Number(r._sum.sales_volume ?? 0)]));

  const crossCheckBySpvId = new Map<string, number>();
  for (const m of mappings) {
    const sales = agentSalesMap.get(m.user_id4) ?? 0;
    crossCheckBySpvId.set(m.spv_user_id, (crossCheckBySpvId.get(m.spv_user_id) ?? 0) + sales);
  }

  const allRows: Row[] = masterList.map((m) => {
    const period = periodMap.get(m.user_id2);
    const monthly = monthlyMap.get(m.user_id2);
    const periodSales = Number(period?.sales_volume2 ?? 0);
    const teamSales = crossCheckBySpvId.get(m.user_id2 ?? "") ?? 0;
    const diff = periodSales - teamSales;
    return {
      level: levelMap.get(m.user_id2) ?? "-",
      spvName: m.user_name2,
      userId: m.user_id2,
      pCard: period?.card_count2 ?? 0,
      pFreq: period?.freq2 ?? 0,
      pSales: periodSales,
      mCard: monthly?.card_count2 ?? 0,
      mFreq: monthly?.freq2 ?? 0,
      mSales: Number(monthly?.sales_volume2 ?? 0),
      teamSales,
      diff,
    };
  });

  const filteredRows = q ? allRows.filter((r) => (r.spvName ?? "").toLowerCase().includes(q)) : allRows;
  const sortedRows = [...filteredRows];
  if (sortKeys.length > 0) sortedRows.sort((a, b) => compareMulti(a, b, sortKeys, sortDirs));

  const zero = { pCard: 0, pFreq: 0, pSales: 0, mCard: 0, mFreq: 0, mSales: 0 };
  const grandTotal = sortedRows.reduce(
    (acc, r) => ({
      pCard: acc.pCard + r.pCard,
      pFreq: acc.pFreq + r.pFreq,
      pSales: acc.pSales + r.pSales,
      mCard: acc.mCard + r.mCard,
      mFreq: acc.mFreq + r.mFreq,
      mSales: acc.mSales + r.mSales,
    }),
    zero
  );

  const isSingleDay = startDate === endDate;
  const periodLabel = isSingleDay ? dateLabelShort(startDate) : `${dateLabelShort(startDate)} – ${dateLabelShort(endDate)}`;

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
    const arrow = idx === -1 ? "" : sortDirs[idx] === "desc" ? " ▼" : " ▲";
    const order = idx === -1 ? "" : ` (${idx + 1})`;
    return (
      <a href={`/spv?${qs.toString()}`} className="hover:underline">
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
            <h1 className="text-2xl font-bold text-slate-800">SUPERVISOR BNI</h1>
            <p className="text-slate-500 text-sm">
              Data QC_CLOS — Periode {periodLabel} · Bulan {monthLabel(startDate)}
            </p>
          </div>
          <HideCekToggle />
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Card ({periodLabel})</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.pCard)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Freq ({periodLabel})</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.pFreq)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Sales Volume ({periodLabel})</p>
            <p className="text-lg font-bold text-slate-800">{fmtRp(grandTotal.pSales)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Sales Volume (Bulan Penuh)</p>
            <p className="text-lg font-bold text-slate-800">{fmtRp(grandTotal.mSales)}</p>
          </div>
        </div>

        <form method="GET" className="mb-2 flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit">
          <label htmlFor="start" className="text-sm text-slate-600">Dari:</label>
          <input type="date" id="start" name="start" defaultValue={startDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="end" className="text-sm text-slate-600">Sampai:</label>
          <input type="date" id="end" name="end" defaultValue={endDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="q" className="text-sm text-slate-600 ml-2">Cari SPV:</label>
          <input
            type="text"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Ketik nama SPV..."
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56"
          />
          {sortKeys.length > 0 && <input type="hidden" name="sort" value={sortKeys.join(",")} />}
          {sortDirs.length > 0 && <input type="hidden" name="dir" value={sortDirs.join(",")} />}
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
          {(q || sortKeys.length > 0) && (
            <a href={`/spv?start=${startDate}&end=${endDate}`} className="text-xs text-blue-600 hover:underline ml-1">
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
          <table className="w-full text-sm border-collapse min-w-[1000px]">
            <thead className="bg-slate-800 text-white sticky top-0">
              <tr>
                <th className="p-3 text-left font-medium">Level</th>
                <th className="p-3 text-left font-medium">{sortLink("spvName", "SPV Name")}</th>
                <th className="p-3 text-left font-medium">User ID</th>
                <th className="p-3 text-right font-medium">{sortLink("pCard", `Card (${periodLabel})`)}</th>
                <th className="p-3 text-right font-medium">{sortLink("pFreq", `Freq (${periodLabel})`)}</th>
                <th className="p-3 text-right font-medium">{sortLink("pSales", `Sales Volume (${periodLabel})`)}</th>
                <th className="p-3 text-right font-medium">{sortLink("mCard", "Card (Bulan)")}</th>
                <th className="p-3 text-right font-medium">{sortLink("mFreq", "Freq (Bulan)")}</th>
                <th className="p-3 text-right font-medium">{sortLink("mSales", "Sales Volume (Bulan)")}</th>
                <th className="p-3 text-right font-medium col-cek">Total Tim Agent (Cek)</th>
                <th className="p-3 text-right font-medium col-cek">Selisih</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, idx) => (
                <tr key={r.userId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5 text-slate-500">{r.level}</td>
                  <td className="p-2.5 text-slate-800 font-medium">{r.spvName}</td>
                  <td className="p-2.5 font-mono text-xs text-slate-600">{r.userId}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.pCard)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.pFreq)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.pSales)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.mCard)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.mFreq)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.mSales)}</td>
                  <td className="p-2.5 text-right tabular-nums text-slate-500 col-cek">{fmtRp(r.teamSales)}</td>
                  <td className={`p-2.5 text-right tabular-nums font-semibold col-cek ${r.diff === 0 ? "text-green-600" : "text-red-600"}`}>
                    {r.diff === 0 ? "Cocok" : fmtRp(r.diff)}
                  </td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={11} className="p-4 text-center text-slate-400">Tidak ada SPV yang cocok.</td>
                </tr>
              )}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="p-3" colSpan={3}>TOTAL KESELURUHAN</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.pCard)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.pFreq)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.pSales)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.mCard)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.mFreq)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.mSales)}</td>
                <td className="p-3 col-cek" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}