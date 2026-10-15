import { Fragment } from "react";
import { prisma } from "../../lib/prisma";
 
function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
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
function dateLabelShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}
function monthLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
 
type DurationRow = { user_id3: string; total_talktime: string | null; total_duration: string | null };
 
export default async function CdPage({
  searchParams,
}: {
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const params = await searchParams;
  let startDate = params.start;
  let endDate = params.end;
 
  if (!startDate || !endDate) {
    const latest = await prisma.cd_daily.aggregate({ _max: { report_date3: true } });
    const latestStr = latest._max.report_date3
      ? latest._max.report_date3.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    startDate = startDate ?? latestStr;
    endDate = endDate ?? latestStr;
  }
  if (new Date(endDate) < new Date(startDate)) {
    [startDate, endDate] = [endDate, startDate];
  }
 
  const monthStart = toMonthStart(startDate);
  const rangeEndExclusive = addDaysUTC(endDate, 1);
 
  // 1. Mapping agent -> SPV & Level (pakai tabel yang sama seperti AG/SPV)
  const mappings = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart },
    include: { agent: true },
    orderBy: [{ spv_name: "asc" }, { user_id4: "asc" }],
  });
 
  // 2. Metrik angka biasa (bisa dijumlah langsung)
  const numAgg = await prisma.cd_daily.groupBy({
    by: ["user_id3"],
    where: { report_date3: { gte: new Date(startDate), lt: rangeEndExclusive } },
    _sum: {
      nsts: true,
      new_count: true,
      fup: true,
      dec_count: true,
      ncn: true,
      npu: true,
      ruf: true,
      atmp: true,
      clos: true,
      sol: true,
    },
  });
  const numMap = new Map(numAgg.map((r) => [r.user_id3, r._sum]));
 
  // 3. Talktime & Duration (tipe interval, pakai raw query) - per agent
  const durationRows = await prisma.$queryRaw<DurationRow[]>`
    SELECT user_id3,
           SUM(talktime)::text AS total_talktime,
           SUM(duration)::text AS total_duration
    FROM cd_daily
    WHERE report_date3 >= ${new Date(startDate)} AND report_date3 < ${rangeEndExclusive}
    GROUP BY user_id3
  `;
  const durationMap = new Map(durationRows.map((r) => [r.user_id3, r]));
 
  // 3b. Talktime & Duration - TOTAL KESELURUHAN (semua agent digabung)
  const grandDurationRows = await prisma.$queryRaw<
    { total_talktime: string | null; total_duration: string | null }[]
  >`
    SELECT SUM(talktime)::text AS total_talktime,
           SUM(duration)::text AS total_duration
    FROM cd_daily
    WHERE report_date3 >= ${new Date(startDate)} AND report_date3 < ${rangeEndExclusive}
  `;
  const grandTalktime = grandDurationRows[0]?.total_talktime ?? "00:00:00";
  const grandDuration = grandDurationRows[0]?.total_duration ?? "00:00:00";
 
  const rows = mappings.map((m) => {
    const n = numMap.get(m.user_id4);
    const d = durationMap.get(m.user_id4);
    return {
      level: m.level,
      spvName: m.spv_name,
      userId: m.user_id4,
      name: m.agent.user_name,
      nsts: n?.nsts ?? 0,
      newCount: n?.new_count ?? 0,
      fup: n?.fup ?? 0,
      dec: n?.dec_count ?? 0,
      ncn: n?.ncn ?? 0,
      npu: n?.npu ?? 0,
      ruf: n?.ruf ?? 0,
      atmp: n?.atmp ?? 0,
      clos: n?.clos ?? 0,
      sol: n?.sol ?? 0,
      talktime: d?.total_talktime ?? "00:00:00",
      duration: d?.total_duration ?? "00:00:00",
    };
  });
 
  const grouped = new Map<string, typeof rows>();
  for (const r of rows) {
    if (!grouped.has(r.spvName)) grouped.set(r.spvName, []);
    grouped.get(r.spvName)!.push(r);
  }
 
  const zero = { nsts: 0, newCount: 0, fup: 0, dec: 0, ncn: 0, npu: 0, ruf: 0, atmp: 0, clos: 0, sol: 0 };
  const grandTotal = rows.reduce(
    (acc, r) => ({
      nsts: acc.nsts + r.nsts,
      newCount: acc.newCount + r.newCount,
      fup: acc.fup + r.fup,
      dec: acc.dec + r.dec,
      ncn: acc.ncn + r.ncn,
      npu: acc.npu + r.npu,
      ruf: acc.ruf + r.ruf,
      atmp: acc.atmp + r.atmp,
      clos: acc.clos + r.clos,
      sol: acc.sol + r.sol,
    }),
    zero
  );
 
  const isSingleDay = startDate === endDate;
  const periodLabel = isSingleDay
    ? dateLabelShort(startDate)
    : `${dateLabelShort(startDate)} – ${dateLabelShort(endDate)}`;
 
  const cols: { key: keyof typeof zero; label: string }[] = [
    { key: "nsts", label: "NSTS" },
    { key: "newCount", label: "New" },
    { key: "fup", label: "FUP" },
    { key: "dec", label: "DEC" },
    { key: "ncn", label: "NCN" },
    { key: "npu", label: "NPU" },
    { key: "ruf", label: "RUF" },
    { key: "atmp", label: "ATMP" },
    { key: "clos", label: "Clos" },
    { key: "sol", label: "Sol" },
  ];
 
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">CALL DURATION</h1>
            <p className="text-slate-500 text-sm">
              Periode {periodLabel} · Bulan {monthLabel(startDate)}
            </p>
          </div>
        </div>
 
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total NSTS</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.nsts)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total New</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.newCount)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total Clos</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.clos)}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
            <p className="text-xs text-slate-500 mb-1">Total ATMP</p>
            <p className="text-lg font-bold text-slate-800">{fmt(grandTotal.atmp)}</p>
          </div>
        </div>
 
        <form
          method="GET"
          className="mb-4 flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit"
        >
          <label htmlFor="start" className="text-sm text-slate-600">Dari:</label>
          <input type="date" id="start" name="start" defaultValue={startDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="end" className="text-sm text-slate-600">Sampai:</label>
          <input type="date" id="end" name="end" defaultValue={endDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
        </form>
 
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[1400px]">
            <thead className="bg-slate-800 text-white sticky top-0">
              <tr>
                <th className="p-3 text-left font-medium">Level</th>
                <th className="p-3 text-left font-medium">SPV Name</th>
                <th className="p-3 text-left font-medium">User ID</th>
                <th className="p-3 text-left font-medium">Name</th>
                {cols.map((c) => (
                  <th key={c.key} className="p-3 text-right font-medium">{c.label}</th>
                ))}
                <th className="p-3 text-right font-medium">Talktime</th>
                <th className="p-3 text-right font-medium">Duration</th>
              </tr>
            </thead>
            <tbody>
              {[...grouped.entries()].map(([spvName, agents]) => {
                const subtotal = agents.reduce(
                  (acc, r) => ({
                    nsts: acc.nsts + r.nsts,
                    newCount: acc.newCount + r.newCount,
                    fup: acc.fup + r.fup,
                    dec: acc.dec + r.dec,
                    ncn: acc.ncn + r.ncn,
                    npu: acc.npu + r.npu,
                    ruf: acc.ruf + r.ruf,
                    atmp: acc.atmp + r.atmp,
                    clos: acc.clos + r.clos,
                    sol: acc.sol + r.sol,
                  }),
                  zero
                );
                const level = agents[0]?.level ?? "";
                return (
                  <Fragment key={spvName}>
                    <tr className="bg-blue-50">
                      <td colSpan={4 + cols.length + 2} className="p-2 px-3 font-semibold text-blue-900 text-xs uppercase tracking-wide">
                        {level} · {spvName}
                      </td>
                    </tr>
                    {agents.map((r, idx) => (
                      <tr key={r.userId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                        <td className="p-2.5 pl-6 text-slate-500">{r.level}</td>
                        <td className="p-2.5 text-slate-500">{r.spvName}</td>
                        <td className="p-2.5 font-mono text-xs text-slate-600">{r.userId}</td>
                        <td className="p-2.5 text-slate-800">{r.name}</td>
                        {cols.map((c) => (
                          <td key={c.key} className="p-2.5 text-right tabular-nums">{fmt(r[c.key])}</td>
                        ))}
                        <td className="p-2.5 text-right tabular-nums font-mono text-xs">{r.talktime}</td>
                        <td className="p-2.5 text-right tabular-nums font-mono text-xs">{r.duration}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-100 font-semibold border-t border-slate-200">
                      <td className="p-2.5" colSpan={4}>Subtotal — {spvName}</td>
                      {cols.map((c) => (
                        <td key={c.key} className="p-2.5 text-right tabular-nums">{fmt(subtotal[c.key])}</td>
                      ))}
                      <td className="p-2.5" colSpan={2}></td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="bg-slate-800 text-white font-bold">
                <td className="p-3" colSpan={4}>TOTAL KESELURUHAN</td>
                {cols.map((c) => (
                  <td key={c.key} className="p-3 text-right tabular-nums">{fmt(grandTotal[c.key])}</td>
                ))}
                <td className="p-3 text-right tabular-nums font-mono text-xs">{grandTalktime}</td>
                <td className="p-3 text-right tabular-nums font-mono text-xs">{grandDuration}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}