import { prisma } from "../../lib/prisma";
import { getAsnAgentCounts } from "../../lib/asnAgentCount";
import { getItkAgentCounts } from "../../lib/itkAgentCount";
import { saveAsnAgentCount, saveItkAgentCount } from "./actions";
import YearlyChart from "./YearlyChart";
import YearlyAvgChart from "./YearlyAvgChart";

const REPORT_TYPE = "QC_CLOS";
const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

type RangeKey = "this" | "6" | "12" | "custom";

const PRESETS: { key: RangeKey; label: string }[] = [
  { key: "this", label: "This Month" },
  { key: "6", label: "Last 6 Month" },
  { key: "12", label: "Last 12 Month" },
];

function fmt(n: number) {
  return new Intl.NumberFormat("id-ID").format(Math.round(n));
}
function fmtRp(n: number) {
  return "Rp " + fmt(n);
}

// Bulan direpresentasikan sebagai indeks: tahun * 12 + bulan (0-11)
function parseMonthIndex(s?: string): number | null {
  const m = /^(\d{4})-(\d{2})$/.exec(s ?? "");
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return Number(m[1]) * 12 + (month - 1);
}
function indexToMonthStr(idx: number) {
  const y = Math.floor(idx / 12);
  const m = idx % 12;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}
function indexLabel(idx: number) {
  const y = Math.floor(idx / 12);
  return `${MONTH_ABBR[idx % 12]}-${String(y).slice(2)}`;
}
function indexStartDate(idx: number) {
  return new Date(Date.UTC(Math.floor(idx / 12), idx % 12, 1));
}

export default async function YearlyItkxAsnPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;

  const now = new Date();
  const currentIdx = now.getUTCFullYear() * 12 + now.getUTCMonth();

  const range: RangeKey = (["this", "6", "12", "custom"] as const).find((r) => r === params.range) ?? "12";

  let startIdx = currentIdx - 11;
  let endIdx = currentIdx;
  if (range === "this") {
    startIdx = currentIdx;
  } else if (range === "6") {
    startIdx = currentIdx - 5;
  } else if (range === "custom") {
    const f = parseMonthIndex(params.from);
    const t = parseMonthIndex(params.to);
    if (f !== null && t !== null) {
      startIdx = Math.min(f, t);
      endIdx = Math.max(f, t);
    }
  }
  // batasi maksimal 60 bulan supaya query tetap ringan
  if (endIdx - startIdx > 59) startIdx = endIdx - 59;

  const rangeStart = indexStartDate(startIdx);
  const rangeEndExclusive = indexStartDate(endIdx + 1);

  // SV ITK = total sales_volume2 semua SPV (sama seperti halaman ITK x ASN), dijumlah per bulan
  const itkPerDay = await prisma.spv_daily.groupBy({
    by: ["report_date2"],
    where: { report_type2: REPORT_TYPE, report_date2: { gte: rangeStart, lt: rangeEndExclusive } },
    _sum: { sales_volume2: true },
  });

  // SV ASN = input manual per hari di halaman ITK x ASN, dijumlah per bulan
  const asnRows = await prisma.asn_target.findMany({
    where: { report_date: { gte: rangeStart, lt: rangeEndExclusive } },
  });

  const itkByIdx = new Map<number, number>();
  const asnByIdx = new Map<number, number>();
  const hasData = new Set<number>();

  for (const r of itkPerDay) {
    const idx = r.report_date2.getUTCFullYear() * 12 + r.report_date2.getUTCMonth();
    itkByIdx.set(idx, (itkByIdx.get(idx) ?? 0) + Number(r._sum.sales_volume2 ?? 0));
    hasData.add(idx);
  }
  for (const r of asnRows) {
    const idx = r.report_date.getUTCFullYear() * 12 + r.report_date.getUTCMonth();
    asnByIdx.set(idx, (asnByIdx.get(idx) ?? 0) + Number(r.sales_volume_asn));
    hasData.add(idx);
  }

  // Hanya bulan yang punya data yang ditampilkan
  const rows: { ym: string; label: string; itk: number; asn: number; gap: number }[] = [];
  for (let idx = startIdx; idx <= endIdx; idx++) {
    if (!hasData.has(idx)) continue;
    const itk = itkByIdx.get(idx) ?? 0;
    const asn = asnByIdx.get(idx) ?? 0;
    rows.push({ ym: indexToMonthStr(idx), label: indexLabel(idx), itk, asn, gap: itk - asn });
  }

  const totalItk = rows.reduce((a, r) => a + r.itk, 0);
  const totalAsn = rows.reduce((a, r) => a + r.asn, 0);
  const totalGap = totalItk - totalAsn;

  // Rata-rata SV per agent per bulan
  // ITK: dibagi jumlah agent bulan itu (dari Resume Agent). ASN: dibagi jumlah agent ASN yang diinput per bulan.
  const config = await prisma.itkxasn_config.findFirst();
  const itkFallback = config?.agent_count_itk ?? 79;
  const asnFallback = config?.agent_count_asn ?? 97;

  const yms = rows.map((r) => r.ym);
  const [itkCounts, asnCounts] = await Promise.all([
    getItkAgentCounts(yms, itkFallback),
    getAsnAgentCounts(yms, asnFallback),
  ]);

  const avgRows = rows.map((r) => {
    const itkInfo = itkCounts.get(r.ym) ?? { count: itkFallback, source: "default" as const, auto: 0 };
    const asnInfo = asnCounts.get(r.ym) ?? { count: asnFallback, source: "default" as const };
    const itkAvg = r.itk / itkInfo.count;
    const asnAvg = r.asn / asnInfo.count;
    return {
      ym: r.ym,
      label: r.label,
      itkAgents: itkInfo.count,
      itkSource: itkInfo.source,
      asnAgents: asnInfo.count,
      asnSource: asnInfo.source,
      itkAvg,
      asnAvg,
      avgGap: itkAvg - asnAvg,
    };
  });

  const periodLabel =
    startIdx === endIdx ? indexLabel(startIdx) : `${indexLabel(startIdx)} – ${indexLabel(endIdx)}`;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">Yearly ITKxASN</h1>
          <p className="text-slate-500 text-sm">Total Sales Volume per bulan — {periodLabel}</p>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit">
          <div className="flex items-center gap-1.5">
            {PRESETS.map((p) => (
              <a
                key={p.key}
                href={`/yearlyitkxasn?range=${p.key}`}
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
            <label htmlFor="from" className="text-sm text-slate-600">Dari:</label>
            <input
              type="month"
              id="from"
              name="from"
              defaultValue={indexToMonthStr(startIdx)}
              className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
            />
            <label htmlFor="to" className="text-sm text-slate-600">Sampai:</label>
            <input
              type="month"
              id="to"
              name="to"
              defaultValue={indexToMonthStr(endIdx)}
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

        <YearlyChart data={rows.map((r) => ({ label: r.label, itk: r.itk, asn: r.asn }))} />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto mb-8">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-center font-medium">MONTH</th>
                <th className="p-3 text-right font-medium">INTIKOM</th>
                <th className="p-3 text-right font-medium">ASIANINDO</th>
                <th className="p-3 text-right font-medium">GAP</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className={r.gap >= 0 ? "bg-green-100" : "bg-red-100"}>
                  <td className="p-2.5 text-center font-medium text-slate-800">{r.label}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.itk)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.asn)}</td>
                  <td className={`p-2.5 text-right tabular-nums font-semibold ${r.gap >= 0 ? "text-green-700" : "text-red-700"}`}>
                    {fmtRp(r.gap)}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-slate-400">Belum ada data untuk periode ini.</td>
                </tr>
              )}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="p-3 text-center">TOTAL</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(totalItk)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(totalAsn)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(totalGap)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <YearlyAvgChart data={avgRows.map((r) => ({ label: r.label, itkAvg: r.itkAvg, asnAvg: r.asnAvg }))} />

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <p className="text-sm font-semibold text-slate-700 p-4 pb-1">Rata-rata SV per Agent</p>
          <p className="text-xs text-slate-500 px-4 pb-3">
            Jumlah agent ITK dan ASN bisa diinput per bulan. Kolom ITK yang dikosongkan memakai jumlah agent
            otomatis dari Resume Agent.
          </p>
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-center font-medium">MONTH</th>
                <th className="p-3 text-right font-medium">AGENT ITK (input)</th>
                <th className="p-3 text-right font-medium">AVG SV / AGENT ITK</th>
                <th className="p-3 text-right font-medium">AGENT ASN (input)</th>
                <th className="p-3 text-right font-medium">AVG SV / AGENT ASN</th>
                <th className="p-3 text-right font-medium">GAP</th>
              </tr>
            </thead>
            <tbody>
              {avgRows.map((r, idx) => (
                <tr key={r.ym} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5 text-center font-medium text-slate-800">{r.label}</td>
                  <td className="p-2.5 text-right">
                    <form action={saveItkAgentCount} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="month" value={r.ym} />
                      <input
                        type="number"
                        name="agent_count"
                        min={1}
                        defaultValue={r.itkSource === "input" ? r.itkAgents : undefined}
                        placeholder={String(r.itkAgents)}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-20 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded"
                      >
                        Simpan
                      </button>
                    </form>
                    <p className={`text-[11px] mt-0.5 ${r.itkSource === "input" ? "text-slate-400" : "text-amber-600"}`}>
                      {r.itkSource === "input"
                        ? "diinput manual (kosongkan lalu Simpan untuk kembali otomatis)"
                        : r.itkSource === "auto"
                          ? "otomatis dari Resume Agent"
                          : "memakai angka default"}
                    </p>
                  </td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.itkAvg)}</td>
                  <td className="p-2.5 text-right">
                    <form action={saveAsnAgentCount} className="flex items-center justify-end gap-2">
                      <input type="hidden" name="month" value={r.ym} />
                      <input
                        type="number"
                        name="agent_count"
                        min={1}
                        defaultValue={r.asnAgents}
                        className="border border-slate-300 rounded px-2 py-1 text-right w-20 tabular-nums"
                      />
                      <button
                        type="submit"
                        className="bg-slate-700 hover:bg-slate-600 text-white text-xs px-2 py-1 rounded"
                      >
                        Simpan
                      </button>
                    </form>
                    {r.asnSource !== "input" && (
                      <p className="text-[11px] text-amber-600 mt-0.5">
                        belum diinput (memakai {r.asnSource === "carry" ? "bulan sebelumnya" : "angka default"})
                      </p>
                    )}
                  </td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.asnAvg)}</td>
                  <td className={`p-2.5 text-right tabular-nums font-semibold ${r.avgGap >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmtRp(r.avgGap)}
                  </td>
                </tr>
              ))}
              {avgRows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-slate-400">Belum ada data untuk periode ini.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}