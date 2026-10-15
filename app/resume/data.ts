import { prisma } from "../../lib/prisma";
 
const REPORT_TYPE = "QC_CLOS";
 
export function toMonthStart(monthStr: string) {
  return new Date(`${monthStr}-01T00:00:00.000Z`);
}
export function nextMonthStart(monthStr: string) {
  const d = toMonthStart(monthStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
export function monthLabel(monthStr: string) {
  return toMonthStart(monthStr).toLocaleDateString("id-ID", { month: "long", year: "numeric", timeZone: "UTC" });
}
export function parseIntervalToSeconds(str: string | null): number {
  if (!str) return 0;
  let rest = str;
  let days = 0;
  const dayMatch = str.match(/^(-?\d+)\s*days?,?\s*(.*)$/);
  if (dayMatch) {
    days = parseInt(dayMatch[1], 10);
    rest = dayMatch[2];
  }
  const timeMatch = rest.match(/^(-?\d+):(\d+):([\d.]+)$/);
  if (!timeMatch) return days * 86400;
  const h = parseInt(timeMatch[1], 10);
  const m = parseInt(timeMatch[2], 10);
  const s = parseFloat(timeMatch[3]);
  return days * 86400 + h * 3600 + m * 60 + s;
}
export function formatSecondsToInterval(totalSeconds: number): string {
  const sign = totalSeconds < 0 ? "-" : "";
  let sec = Math.round(Math.abs(totalSeconds));
  const days = Math.floor(sec / 86400);
  sec %= 86400;
  const h = Math.floor(sec / 3600);
  sec %= 3600;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const pad = (v: number) => String(v).padStart(2, "0");
  const prefix = days > 0 ? `${days} hari ` : "";
  return `${sign}${prefix}${pad(h)}:${pad(m)}:${pad(s)}`;
}
 
type CdAgg = { user_id3: string; working_days: number; total_sol: number | null; total_atmp: number | null; avg_duration: string | null };
 
export async function getResumeData(monthParam?: string) {
  let month = monthParam;
  if (!month) {
    const latest = await prisma.ag_daily.aggregate({ where: { report_type: REPORT_TYPE }, _max: { report_date: true } });
    const latestStr = latest._max.report_date ? latest._max.report_date.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
    month = latestStr.slice(0, 7);
  }
 
  const monthStart = toMonthStart(month);
  const monthEnd = nextMonthStart(month);
 
  const mappings = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart },
    include: { agent: true },
    orderBy: [{ spv_name: "asc" }, { user_id4: "asc" }],
  });
 
  const agAgg = await prisma.ag_daily.groupBy({
    by: ["user_id"],
    where: { report_type: REPORT_TYPE, report_date: { gte: monthStart, lt: monthEnd } },
    _sum: { card_count: true, freq: true, sales_volume: true, bunga_0: true, bunga_regular: true },
  });
  const agMap = new Map(agAgg.map((r) => [r.user_id, r._sum]));
 
  const cdAgg = await prisma.$queryRaw<CdAgg[]>`
    SELECT user_id3,
           COUNT(*)::int AS working_days,
           SUM(sol) AS total_sol,
           SUM(atmp) AS total_atmp,
           (SUM(duration) / COUNT(*))::text AS avg_duration
    FROM cd_daily
    WHERE report_date3 >= ${monthStart} AND report_date3 < ${monthEnd}
    GROUP BY user_id3
  `;
  const cdMap = new Map(cdAgg.map((r) => [r.user_id3, r]));
 
  const rows = mappings.map((m) => {
    const ag = agMap.get(m.user_id4);
    const cd = cdMap.get(m.user_id4);
    const sales = Number(ag?.sales_volume ?? 0);
    const bunga0 = Number(ag?.bunga_0 ?? 0);
    const bungaReg = Number(ag?.bunga_regular ?? 0);
    const workingDays = cd?.working_days ?? 0;
    const totalSol = Number(cd?.total_sol ?? 0);
    const totalAtmp = Number(cd?.total_atmp ?? 0);
 
    return {
      level: m.level,
      spvName: m.spv_name,
      userId: m.user_id4,
      name: m.agent.user_name,
      card: ag?.card_count ?? 0,
      freq: ag?.freq ?? 0,
      sales,
      workingDays,
      sol: workingDays > 0 ? totalSol / workingDays : 0,
      duration: formatSecondsToInterval(parseIntervalToSeconds(cd?.avg_duration ?? null)),
      attemptRatio: workingDays > 0 ? totalAtmp / workingDays : 0,
      bunga0Pct: sales > 0 ? bunga0 / sales : 0,
      bungaRegPct: sales > 0 ? bungaReg / sales : 0,
    };
  });
 
  const grandCard = rows.reduce((a, r) => a + r.card, 0);
  const grandFreq = rows.reduce((a, r) => a + r.freq, 0);
  const grandSales = rows.reduce((a, r) => a + r.sales, 0);
  const grandSol = rows.reduce((a, r) => a + r.sol, 0);
  const grandAttemptRatio = rows.length > 0 ? rows.reduce((a, r) => a + r.attemptRatio, 0) / rows.length : 0;
  const grandDurationSeconds = rows.length > 0 ? rows.reduce((a, r) => a + parseIntervalToSeconds(r.duration), 0) / rows.length : 0;
  const grandDuration = formatSecondsToInterval(grandDurationSeconds);
 
  return { month, rows, grandCard, grandFreq, grandSales, grandSol, grandAttemptRatio, grandDuration, grandDurationSeconds };
}