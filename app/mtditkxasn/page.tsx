import { prisma } from "../../lib/prisma";
import ItkAsnChart from "../itkxasn/ItkAsnChart";

const REPORT_TYPE = "QC_CLOS";

type RangeKey = "30" | "this" | "prev" | "custom";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "30", label: "Last 30 Day" },
  { key: "this", label: "This Month" },
  { key: "prev", label: "Previous Month" },
];

function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}
function monthStartOf(dateStr: string) {
  return dateStr.slice(0, 8) + "01";
}
function isDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function dateLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function MtdItkxAsnPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; start?: string; end?: string }>;
}) {
  const params = await searchParams;

  // Preset dihitung dari tanggal data ITK terbaru
  const latest = await prisma.spv_daily.aggregate({
    where: { report_type2: REPORT_TYPE },
    _max: { report_date2: true },
  });
  const latestStr = latest._max.report_date2 ? toDateStr(latest._max.report_date2) : toDateStr(new Date());

  let range: RangeKey =
    (["30", "this", "prev", "custom"] as const).find((r) => r === params.range) ??
    (params.start && params.end ? "custom" : "this");

  let startDate = monthStartOf(latestStr);
  let endDate = latestStr;

  if (range === "30") {
    startDate = addDays(latestStr, -29);
  } else if (range === "prev") {
    endDate = addDays(monthStartOf(latestStr), -1);
    startDate = monthStartOf(endDate);
  } else if (range === "custom") {
    if (isDate(params.start) && isDate(params.end)) {
      startDate = params.start;
      endDate = params.end;
    } else {
      range = "this";
    }
  }
  if (endDate < startDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const rangeStart = new Date(startDate);
  const rangeEndExclusive = new Date(addDays(endDate, 1));

  // SV ITK per hari = total sales_volume2 semua SPV; SV ASN per hari = input manual
  const [itkPerDay, asnRows] = await Promise.all([
    prisma.spv_daily.groupBy({
      by: ["report_date2"],
      where: { report_type2: REPORT_TYPE, report_date2: { gte: rangeStart, lt: rangeEndExclusive } },
      _sum: { sales_volume2: true },
    }),
    prisma.asn_target.findMany({
      where: { report_date: { gte: rangeStart, lt: rangeEndExclusive } },
    }),
  ]);

  const itkMap = new Map(itkPerDay.map((r) => [toDateStr(r.report_date2), Number(r._sum.sales_volume2 ?? 0)]));
  const asnMap = new Map(asnRows.map((r) => [toDateStr(r.report_date), Number(r.sales_volume_asn)]));

  const dates = Array.from(new Set([...itkMap.keys(), ...asnMap.keys()])).sort();

  // Field itkAvg/asnAvg dipakai karena ItkAsnChart membaca nama field itu (isinya total SV)
  const dailyData = dates.map((d) => ({
    date: d,
    itkAvg: itkMap.get(d) ?? 0,
    asnAvg: asnMap.get(d) ?? 0,
  }));

  let itkCum = 0;
  let asnCum = 0;
  const cumulativeData = dailyData.map((r) => {
    itkCum += r.itkAvg;
    asnCum += r.asnAvg;
    return { date: r.date, itkAvg: itkCum, asnAvg: asnCum };
  });

  const periodLabel = startDate === endDate ? dateLabel(startDate) : `${dateLabel(startDate)} – ${dateLabel(endDate)}`;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">MTD ITK x ASN</h1>
          <p className="text-slate-500 text-sm">Month to Date Sales Volume — {periodLabel}</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => (
              <a
                key={p.key}
                href={`/mtditkxasn?range=${p.key}`}
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

        {dailyData.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-center text-sm text-slate-400">
            Belum ada data untuk periode ini.
          </div>
        ) : (
          <>
            <ItkAsnChart data={dailyData} title="Sales Volume ITK vs ASN (Harian)" />
            <ItkAsnChart data={cumulativeData} title="Sales Volume ITK vs ASN (Akumulatif)" />
          </>
        )}
      </div>
    </main>
  );
}