import { getAvailableMonths, getFloorPerformanceData, getFloorProductivityData, getFloorProductivityPart2Data, getKpiPerformanceData, KPI_2025_TARGET, monthLabelShort } from "./data";
import FloorPerformanceChart from "./FloorPerformanceChart";
import FloorProductivityChart from "./FloorProductivityChart";
import SolDurationChart from "./SolDurationChart";


function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}
function fmt1(n: number) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 }).format(n);
}
function fmtRp(n: number) {
  return "Rp " + fmt(n);
}


export default async function MonthlyBniPage({
  searchParams,
}: {
  searchParams: Promise<{ months?: string | string[] }>;
}) {
  const params = await searchParams;
  const availableMonths = await getAvailableMonths();

  const raw = params.months;
  const monthsArray = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const selectedMonths = monthsArray.filter((m) => availableMonths.includes(m));
  const finalMonths = selectedMonths.length > 0 ? selectedMonths : availableMonths;

  const floorPerf = await getFloorPerformanceData(finalMonths);
  const floorPerfChartData = floorPerf.map((r) => ({ ...r, monthLabel: monthLabelShort(r.month) }));
  const productivity = await getFloorProductivityData(finalMonths);
  const monthLabels = finalMonths.map((m) => monthLabelShort(m));
  const part2 = await getFloorProductivityPart2Data(finalMonths);
  const kpi = await getKpiPerformanceData(finalMonths);

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Monthly BNI</h1>
          <p className="text-slate-500 text-sm">Komparasi performa antar bulan</p>
        </div>

        <form
          method="GET"
          className="mb-6 flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit"
        >
          <span className="text-sm text-slate-600">Bulan:</span>
          {availableMonths.map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm text-slate-700">
              <input type="checkbox" name="months" value={m} defaultChecked={finalMonths.includes(m)} />
              {monthLabelShort(m)}
            </label>
          ))}
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
        </form>

        <FloorPerformanceChart data={floorPerfChartData} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <FloorProductivityChart title="Infinite" data={productivity.infinite} monthLabels={monthLabels} />
          <FloorProductivityChart title="Platinum" data={productivity.platinum} monthLabels={monthLabels} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <SolDurationChart title="SOLICITED PERFORMANCE" data={part2.solicited} geLabel=">=550" ltLabel="<550" />
          <SolDurationChart title="CALL DURATION PERFORMANCE" data={part2.callDuration} geLabel=">=7 Jam" ltLabel="<7 Jam" />
        </div>


        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <p className="text-sm font-semibold text-slate-700 p-4 pb-0">KPI Performance</p>
          <table className="w-full text-sm border-collapse mt-3">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-3 text-left font-medium">Keterangan</th>
                <th className="p-3 text-right font-medium">KPI 2025</th>
                {kpi.map((k) => (
                  <th key={k.month} className="p-3 text-right font-medium">{k.monthLabel}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="p-2.5 text-slate-600">Business Days</td>
                <td className="p-2.5 text-right text-slate-400">-</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmt(k.businessDays)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="p-2.5 text-slate-600">Working Days</td>
                <td className="p-2.5 text-right text-slate-400">-</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmt(k.workingDaysAvg)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="p-2.5 text-slate-800 font-medium">Total Agent</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(KPI_2025_TARGET.totalAgent)}</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmt(k.totalAgent)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-slate-50">
                <td className="p-2.5 text-slate-800 font-medium">Total Card</td>
                <td className="p-2.5 text-right tabular-nums">{fmt(KPI_2025_TARGET.totalCard)}</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmt(k.totalCard)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100">
                <td className="p-2.5 text-slate-800 font-medium">Total Sales Volume</td>
                <td className="p-2.5 text-right tabular-nums">{fmtRp(KPI_2025_TARGET.totalSalesVolume)}</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmtRp(k.totalSalesVolume)}</td>
                ))}
              </tr>
              <tr className="border-b border-slate-100 bg-amber-50">
                <td className="p-2.5 text-slate-800 font-medium">Agent Productivity (Card/Hari)</td>
                <td className="p-2.5 text-right tabular-nums">{fmt1(KPI_2025_TARGET.agentProductivity)}</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmt1(k.agentProductivity)}</td>
                ))}
              </tr>
              <tr>
                <td className="p-2.5 text-slate-800 font-medium">Spend per Card</td>
                <td className="p-2.5 text-right tabular-nums">{fmtRp(KPI_2025_TARGET.spendPerCard)}</td>
                {kpi.map((k) => (
                  <td key={k.month} className="p-2.5 text-right tabular-nums">{fmtRp(k.spendPerCard)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}