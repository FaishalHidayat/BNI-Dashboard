import { prisma } from "../../lib/prisma";
import MonthlySvChart from "./MonthlySvChart";

const REPORT_TYPE = "QC_CLOS";
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type RangeKey = "this" | "6" | "12" | "custom";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "this", label: "This Month" },
  { key: "6", label: "Last 6 Month" },
  { key: "12", label: "Last 12 Month" },
];

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
}
function fmtRp(n: number | null | undefined) {
  return "Rp " + fmt(n);
}
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDaysUTC(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function dateLabelShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

// Bulan direpresentasikan sebagai indeks: tahun * 12 + bulan (0-11)
function monthIndexOf(d: Date) {
  return d.getUTCFullYear() * 12 + d.getUTCMonth();
}
function indexLabel(idx: number) {
  const y = Math.floor(idx / 12);
  return `${MONTH_ABBR[idx % 12]}-${String(y).slice(2)}`;
}
function indexStartStr(idx: number) {
  return toDateStr(new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1)));
}

export default async function PrfmPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;

  // Preset dihitung dari bulan data terbaru
  const latest = await prisma.spv_daily.aggregate({
    where: { report_type2: REPORT_TYPE },
    _max: { report_date2: true },
  });
  const latestDate = latest._max.report_date2 ?? new Date();
  const latestStr = toDateStr(latestDate);
  const anchorIdx = monthIndexOf(latestDate);

  let range: RangeKey =
    (["this", "6", "12", "custom"] as const).find((r) => r === params.range) ??
    (params.start && params.end ? "custom" : "this");

  let startDate = indexStartStr(anchorIdx);
  let endDate = latestStr;
  if (range === "6") {
    startDate = indexStartStr(anchorIdx - 5);
  } else if (range === "12") {
    startDate = indexStartStr(anchorIdx - 11);
  } else if (range === "custom") {
    if (params.start && params.end) {
      startDate = params.start;
      endDate = params.end;
    } else {
      range = "this";
    }
  }
  if (new Date(endDate) < new Date(startDate)) {
    [startDate, endDate] = [endDate, startDate];
  }

  const rangeEndExclusive = addDaysUTC(endDate, 1);

  // Total seluruh SPV per hari
  const perDay = await prisma.spv_daily.groupBy({
    by: ["report_date2"],
    where: {
      report_type2: REPORT_TYPE,
      report_date2: { gte: new Date(startDate), lt: rangeEndExclusive },
    },
    _sum: {
      card_count2: true,
      freq2: true,
      bunga_02: true,
      bunga_regular2: true,
      sales_volume2: true,
    },
    orderBy: { report_date2: "asc" },
  });

  const rows = perDay.map((r) => ({
    date: toDateStr(r.report_date2),
    card: r._sum.card_count2 ?? 0,
    freq: r._sum.freq2 ?? 0,
    bunga0: Number(r._sum.bunga_02 ?? 0),
    bungaReg: Number(r._sum.bunga_regular2 ?? 0),
    sales: Number(r._sum.sales_volume2 ?? 0),
  }));

  const zero = { card: 0, freq: 0, bunga0: 0, bungaReg: 0, sales: 0 };
  const grandTotal = rows.reduce(
    (acc, r) => ({
      card: acc.card + r.card,
      freq: acc.freq + r.freq,
      bunga0: acc.bunga0 + r.bunga0,
      bungaReg: acc.bungaReg + r.bungaReg,
      sales: acc.sales + r.sales,
    }),
    zero
  );

  // Total SV per bulan untuk grafik (rows sudah urut tanggal, jadi urutan bulan ikut benar)
  const monthlySales = new Map<number, number>();
  for (const r of rows) {
    const idx = monthIndexOf(new Date(r.date));
    monthlySales.set(idx, (monthlySales.get(idx) ?? 0) + r.sales);
  }
  const chartData = Array.from(monthlySales, ([idx, sales]) => ({ label: indexLabel(idx), sales }));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">PERFORMANCE BNI</h1>
            <p className="text-slate-500 text-sm">
              Performa Harian Perusahaan — {dateLabelShort(startDate)} – {dateLabelShort(endDate)}
            </p>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => (
              <a
                key={p.key}
                href={`/prfm?range=${p.key}`}
                className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                  range === p.key
                    ? "bg-slate-800 text-white border-slate-800"
                    : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                }`}
              >
                {p.label}
              </a>
            ))}
          </div>

          <form method="GET" className="flex flex-wrap items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-3">
            <input type="hidden" name="range" value="custom" />
            <label htmlFor="start" className="text-sm text-slate-600">Dari:</label>
            <input
              type="date"
              id="start"
              name="start"
              defaultValue={startDate}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <label htmlFor="end" className="text-sm text-slate-600">Sampai:</label>
            <input
              type="date"
              id="end"
              name="end"
              defaultValue={endDate}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              type="submit"
              className={`text-sm px-3 py-1.5 rounded-lg border transition ${
                range === "custom"
                  ? "bg-slate-800 text-white border-slate-800"
                  : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
              }`}
            >
              Custom
            </button>
          </form>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Card</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.card)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Freq</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.freq)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Sales Volume</p>
            <p className="text-lg font-bold text-slate-800">{fmtRp(grandTotal.sales)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Bunga Regular</p>
            <p className="text-lg font-bold text-slate-800">{fmtRp(grandTotal.bungaReg)}</p>
          </div>
        </div>

        <MonthlySvChart data={chartData} />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-left font-medium">Date</th>
                <th className="p-3 text-right font-medium">Card</th>
                <th className="p-3 text-right font-medium">Freq</th>
                <th className="p-3 text-right font-medium">Bunga 0%</th>
                <th className="p-3 text-right font-medium">Bunga Regular</th>
                <th className="p-3 text-right font-medium">Sales Volume</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.date} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5">{dateLabelShort(r.date)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.card)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.freq)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.bunga0)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.bungaReg)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.sales)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">Belum ada data untuk periode ini.</td>
                </tr>
              )}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="p-3">TOTAL KESELURUHAN</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.card)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandTotal.freq)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.bunga0)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.bungaReg)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandTotal.sales)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}