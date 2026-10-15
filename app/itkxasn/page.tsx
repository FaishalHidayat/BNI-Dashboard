import { prisma } from "../../lib/prisma";
import { getAsnAgentCounts } from "../../lib/asnAgentCount";
import { updateAsn } from "./action";
import ItkAsnChart from "./ItkAsnChart";
import AsnInput from "./AsnInput";
import { getItkAgentCounts } from "../../lib/itkAgentCount";
import MtdSection from "./MtdSection";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
}
function fmtRp(n: number | null | undefined) {
  return "Rp " + fmt(n);
}
function addDaysUTC(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function dateLabelShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

const REPORT_TYPE = "QC_CLOS";
const MTD_KEYS = ["mtdsrc", "mtdp", "mtdps", "mtdpe", "mtdc", "mtdcs", "mtdce"] as const;

export default async function ItkxAsnPage({
  searchParams,
}: {
  searchParams: Promise<{
    start?: string;
    end?: string;
    mtdsrc?: string;
    mtdp?: string;
    mtdps?: string;
    mtdpe?: string;
    mtdc?: string;
    mtdcs?: string;
    mtdce?: string;
  }>;
}) {
  const params = await searchParams;
  let startDate = params.start;
  let endDate = params.end;

  if (!startDate || !endDate) {
    const latest = await prisma.spv_daily.aggregate({
      where: { report_type2: REPORT_TYPE },
      _max: { report_date2: true },
    });
    const latestStr = latest._max.report_date2 ? toDateStr(latest._max.report_date2) : toDateStr(new Date());
    // Default: tampilkan dari awal bulan sampai tanggal terbaru
    const monthStartOfLatest = new Date(latestStr);
    monthStartOfLatest.setUTCDate(1);
    startDate = startDate ?? toDateStr(monthStartOfLatest);
    endDate = endDate ?? latestStr;
  }
  if (new Date(endDate) < new Date(startDate)) {
    [startDate, endDate] = [endDate, startDate];
  }

  const rangeEndExclusive = addDaysUTC(endDate, 1);

  // 1. Sales Volume ITK per hari = total sales_volume2 semua SPV per tanggal
  const itkPerDay = await prisma.spv_daily.groupBy({
    by: ["report_date2"],
    where: {
      report_type2: REPORT_TYPE,
      report_date2: { gte: new Date(startDate), lt: rangeEndExclusive },
    },
    _sum: { sales_volume2: true },
    orderBy: { report_date2: "asc" },
  });

  // 2. Sales Volume ASN per hari (input manual)
  const asnRows = await prisma.asn_target.findMany({
    where: { report_date: { gte: new Date(startDate), lt: rangeEndExclusive } },
  });
  const asnMap = new Map(asnRows.map((r) => [toDateStr(r.report_date), Number(r.sales_volume_asn)]));

  const rows = itkPerDay.map((r) => {
    const dateStr = toDateStr(r.report_date2);
    const itk = Number(r._sum.sales_volume2 ?? 0);
    const asn = asnMap.get(dateStr) ?? 0;
    return { date: dateStr, itk, asn, selisih: itk - asn };
  });

  // 3. Pembagi rata-rata agent, dihitung per bulan
  // ITK: jumlah agent bulan itu (sumber sama dengan Resume Agent)
  // ASN: jumlah agent ASN yang diinput per bulan (halaman Yearly ITKxASN)
  const config = await prisma.itkxasn_config.findFirst();
  const itkFallback = config?.agent_count_itk ?? 79;
  const asnFallback = config?.agent_count_asn ?? 97;

  const months = Array.from(new Set(rows.map((r) => r.date.slice(0, 7))));
  const [itkCounts, asnCounts] = await Promise.all([
    getItkAgentCounts(months, itkFallback),
    getAsnAgentCounts(months, asnFallback),
  ]);

  const itkCountOn = (d: string) => itkCounts.get(d.slice(0, 7))?.count ?? itkFallback;
  const asnCountOn = (d: string) => asnCounts.get(d.slice(0, 7))?.count ?? asnFallback;

  const totalItk = rows.reduce((a, r) => a + r.itk, 0);
  const totalAsn = rows.reduce((a, r) => a + r.asn, 0);
  const totalSelisih = totalItk - totalAsn;

  // Rata-rata per agent: SV tiap hari dibagi jumlah agent pada bulan hari itu, lalu dijumlahkan
  const avgItk = rows.reduce((a, r) => a + r.itk / itkCountOn(r.date), 0);
  const avgAsn = rows.reduce((a, r) => a + r.asn / asnCountOn(r.date), 0);
  const avgSelisih = avgItk - avgAsn;

  // Label pembagi di kartu: satu angka kalau sama sepanjang periode, atau beberapa angka kalau berbeda per bulan
  const itkDivisorLabel = Array.from(new Set(months.map((ym) => itkCounts.get(ym)?.count ?? itkFallback))).join(" / ") || itkFallback;
  const asnDivisorLabel = Array.from(new Set(months.map((ym) => asnCounts.get(ym)?.count ?? asnFallback))).join(" / ") || asnFallback;

  // data harian untuk chart, dibagi jumlah agent pada bulan masing-masing hari
  const chartData = rows.map((r) => ({
    date: r.date,
    itkAvg: r.itk / itkCountOn(r.date),
    asnAvg: r.asn / asnCountOn(r.date),
  }));
  // data harian total SV (tanpa dibagi jumlah agent)
  const svChartData = rows.map((r) => ({
    date: r.date,
    itkAvg: r.itk,
    asnAvg: r.asn,
  }));
  // data akumulatif (running total) dari rata-rata per agent, hari demi hari
  let itkCum = 0;
  let asnCum = 0;
  const cumulativeChartData = chartData.map((r) => {
    itkCum += r.itkAvg;
    asnCum += r.asnAvg;
    return { date: r.date, itkAvg: itkCum, asnAvg: asnCum };
  });
  // data akumulatif (running total) dari total SV, hari demi hari
  let itkSvCum = 0;
  let asnSvCum = 0;
  const cumulativeSvChartData = svChartData.map((r) => {
    itkSvCum += r.itkAvg;
    asnSvCum += r.asnAvg;
    return { date: r.date, itkAvg: itkSvCum, asnAvg: asnSvCum };
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">ITK x ASN</h1>
            <p className="text-slate-500 text-sm">
              {dateLabelShort(startDate)} – {dateLabelShort(endDate)}
            </p>
          </div>
          <a href="/yearlyitkxasn" className="text-xs text-blue-600 hover:underline">
            Atur jumlah agent ASN per bulan
          </a>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Rata-rata / Agent (ITK, ÷{itkDivisorLabel})</p>
            <p className="text-lg font-bold text-slate-800">{fmtRp(avgItk)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Rata-rata / Agent (ASN, ÷{asnDivisorLabel})</p>
            <p className="text-lg font-bold text-slate-800">{fmtRp(avgAsn)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Selisih Rata-rata / Agent</p>
            <p className={`text-lg font-bold ${avgSelisih >= 0 ? "text-green-600" : "text-red-600"}`}>
              {fmtRp(avgSelisih)}
            </p>
          </div>
        </div>

        <ItkAsnChart data={chartData} />

        <ItkAsnChart data={svChartData} title="Sales Volume ITK vs ASN" />

        <ItkAsnChart data={cumulativeChartData} title="Rata-rata Agent (Akumulatif)" />

        <ItkAsnChart data={cumulativeSvChartData} title="Sales Volume ITK vs ASN (Akumulatif)" />

        <MtdSection searchParams={params} basePath="/itkxasn" />

        <form
          method="GET"
          className="mb-4 flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit"
        >
          {MTD_KEYS.map((k) => {
            const v = params[k];
            return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
          })}

          <label htmlFor="start" className="text-sm text-slate-600">Dari:</label>
          <input type="date" id="start" name="start" defaultValue={startDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="end" className="text-sm text-slate-600">Sampai:</label>
          <input type="date" id="end" name="end" defaultValue={endDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-left font-medium">Tanggal</th>
                <th className="p-3 text-right font-medium">Sales Volume ITK</th>
                <th className="p-3 text-right font-medium">Sales Volume ASN (input)</th>
                <th className="p-3 text-right font-medium">Selisih SV</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.date} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5">{dateLabelShort(r.date)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.itk)}</td>
                  <td className="p-2.5 text-right">
                    <form action={updateAsn} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="date" value={r.date} />
                      <AsnInput name="asn_value" defaultValue={r.asn} />
                      <button
                        type="submit"
                        className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded"
                      >
                        Simpan
                      </button>
                    </form>
                  </td>
                  <td
                    className={`p-2.5 text-right tabular-nums font-semibold ${
                      r.selisih >= 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {fmtRp(r.selisih)}
                  </td>
                </tr>
              ))}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="p-3">TOTAL KESELURUHAN</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(totalItk)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(totalAsn)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(totalSelisih)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}