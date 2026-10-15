import { prisma } from "../../lib/prisma";
 
const REPORT_TYPE = "QC_CLOS";
 
export function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
export function toMonthStart(dateStr: string) {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}
export function addDaysUTC(dateStr: string, days: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}
export function dateLabelShort(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
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
 
export async function getDailyBniData(dateParam?: string) {
  let selectedDate = dateParam;
  if (!selectedDate) {
    const latest = await prisma.spv_daily.aggregate({ where: { report_type2: REPORT_TYPE }, _max: { report_date2: true } });
    selectedDate = latest._max.report_date2 ? toDateStr(latest._max.report_date2) : toDateStr(new Date());
  }
 
  const monthStart = toMonthStart(selectedDate);
  const rangeEndExclusive = addDaysUTC(selectedDate, 1);
 
  const masterList = await prisma.spv_daily.findMany({
    where: { report_type2: REPORT_TYPE, report_date2: { gte: monthStart, lt: rangeEndExclusive } },
    distinct: ["user_id2"],
    select: { user_id2: true, user_name2: true },
  });
  const spvLevelRows = await prisma.agent_spv_mapping.findMany({
  where: { period_month: monthStart, spv_user_id: { in: masterList.map((m) => m.user_id2) } },
  distinct: ["spv_user_id"],
  select: { spv_user_id: true, level: true },
  });
  const levelMap = new Map(spvLevelRows.map((r) => [r.spv_user_id, r.level]));
 
  const cumAgg = await prisma.spv_daily.groupBy({
    by: ["user_id2"],
    where: { report_type2: REPORT_TYPE, report_date2: { gte: monthStart, lt: rangeEndExclusive } },
    _sum: { card_count2: true, freq2: true, sales_volume2: true, bunga_02: true, bunga_regular2: true },
    _count: { _all: true },
  });
  const cumMap = new Map(cumAgg.map((r) => [r.user_id2, r]));
 
  const targets = await prisma.level_target.findMany();
  const targetMap = new Map(targets.map((t) => [t.level.toUpperCase(), Number(t.target_amount)]));
  const agentTargetMap = new Map(targets.map((t) => [t.level.toUpperCase(), Number(t.agent_target_amount ?? 0)]));
 
  const agentAgAgg = await prisma.ag_daily.groupBy({
    by: ["user_id"],
    where: { report_type: REPORT_TYPE, report_date: { gte: monthStart, lt: rangeEndExclusive } },
    _sum: { card_count: true, freq: true, sales_volume: true, bunga_0: true, bunga_regular: true },
  });
  const agentAgMap = new Map(agentAgAgg.map((r) => [r.user_id, r._sum]));
 
  const cdAgg = await prisma.$queryRaw<CdAgg[]>`
    SELECT user_id3,
           COUNT(*)::int AS working_days,
           SUM(sol) AS total_sol,
           SUM(atmp) AS total_atmp,
           (SUM(duration) / COUNT(*))::text AS avg_duration
    FROM cd_daily
    WHERE report_date3 >= ${monthStart} AND report_date3 < ${rangeEndExclusive}
    GROUP BY user_id3
  `;
  const agentMappings = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart },
    include: { agent: true },
  });
 
  const perSpvAgentMetrics = new Map<string, { sol: number[]; attempt: number[]; durationSec: number[] }>();
  const agentCountMap = new Map<string, number>();
  for (const m of agentMappings) {
    agentCountMap.set(m.spv_user_id, (agentCountMap.get(m.spv_user_id) ?? 0) + 1);
  }
  for (const m of agentMappings) {
    const cd = cdAgg.find((c) => c.user_id3 === m.user_id4);
    if (!cd || cd.working_days === 0) continue;
    const sol = Number(cd.total_sol ?? 0) / cd.working_days;
    const attempt = Number(cd.total_atmp ?? 0) / cd.working_days;
    const durationSec = parseIntervalToSeconds(cd.avg_duration);
    if (!perSpvAgentMetrics.has(m.spv_user_id)) {
      perSpvAgentMetrics.set(m.spv_user_id, { sol: [], attempt: [], durationSec: [] });
    }
    const bucket = perSpvAgentMetrics.get(m.spv_user_id)!;
    bucket.sol.push(sol);
    bucket.attempt.push(attempt);
    bucket.durationSec.push(durationSec);
  }
  const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
 
  const rows = masterList.map((m) => {
    const cum = cumMap.get(m.user_id2);
    const level = levelMap.get(m.user_id2) ?? "-";
    const card = cum?._sum.card_count2 ?? 0;
    const enrol = cum?._sum.freq2 ?? 0;
    const amount = Number(cum?._sum.sales_volume2 ?? 0);
    const bunga0 = Number(cum?._sum.bunga_02 ?? 0);
    const bungaReg = Number(cum?._sum.bunga_regular2 ?? 0);
    const hkAsof = cum?._count._all ?? 0;
    const avgPerDay = hkAsof > 0 ? amount / hkAsof : 0;
 
    const teamMetrics = perSpvAgentMetrics.get(m.user_id2) ?? { sol: [], attempt: [], durationSec: [] };
    const sol = avg(teamMetrics.sol);
    const attempt = avg(teamMetrics.attempt);
    const durationSec = avg(teamMetrics.durationSec);
 
    const target = targetMap.get((level ?? "").toUpperCase()) ?? 0;
    const gap = amount - target;
    const agentCount = agentCountMap.get(m.user_id2) ?? 0;
 
    return {
      level,
      spvName: m.user_name2,
      userId: m.user_id2,
      agentCount,
      card,
      enrol,
      amount,
      hkAsof,
      avgPerDay,
      sol,
      duration: formatSecondsToInterval(durationSec),
      attempt,
      bunga0Pct: amount > 0 ? bunga0 / amount : 0,
      bungaRegPct: amount > 0 ? bungaReg / amount : 0,
      target,
      gap,
    };
  });
 
  const levelOrder: Record<string, number> = { INFINITE: 0, PLATINUM: 1 };
  rows.sort((a, b) => {
    const rankA = levelOrder[(a.level ?? "").toUpperCase()] ?? 99;
    const rankB = levelOrder[(b.level ?? "").toUpperCase()] ?? 99;
    if (rankA !== rankB) return rankA - rankB;
    return (a.spvName ?? "").localeCompare(b.spvName ?? "");
  });
 
  const teamRows = agentMappings.map((m) => {
    const ag = agentAgMap.get(m.user_id4);
    const cd = cdAgg.find((c) => c.user_id3 === m.user_id4);
    const card = ag?.card_count ?? 0;
    const enrol = ag?.freq ?? 0;
    const amount = Number(ag?.sales_volume ?? 0);
    const bunga0 = Number(ag?.bunga_0 ?? 0);
    const bungaReg = Number(ag?.bunga_regular ?? 0);
    const hkAsof = cd?.working_days ?? 0;
    const totalSol = Number(cd?.total_sol ?? 0);
    const totalAtmp = Number(cd?.total_atmp ?? 0);
 
    const spvUserId = m.spv_user_id;
    const spvRow = rows.find((r) => r.userId === spvUserId);
    const level = spvRow?.level ?? "-";
    const target = agentTargetMap.get((level ?? "").toUpperCase()) ?? 0;
 
    return {
      spvName: spvRow?.spvName ?? "-",
      userId: m.user_id4,
      name: m.agent.user_name ?? "-",
      level,
      card,
      enrol,
      amount,
      hkAsof,
      avgPerDay: hkAsof > 0 ? amount / hkAsof : 0,
      sol: hkAsof > 0 ? totalSol / hkAsof : 0,
      duration: formatSecondsToInterval(hkAsof > 0 ? parseIntervalToSeconds(cd?.avg_duration ?? null) : 0),
      attempt: hkAsof > 0 ? totalAtmp / hkAsof : 0,
      bunga0Pct: amount > 0 ? bunga0 / amount : 0,
      bungaRegPct: amount > 0 ? bungaReg / amount : 0,
      target,
      gap: amount - target,
    };
  });
 
  const infiniteTeamRows = teamRows.filter((r) => (r.level ?? "").toUpperCase() === "INFINITE").sort((a, b) => b.amount - a.amount);
  const platinumTeamRows = teamRows.filter((r) => (r.level ?? "").toUpperCase() === "PLATINUM").sort((a, b) => b.amount - a.amount);
 
  const teamTotal = (list: typeof teamRows) => ({
    card: list.reduce((a, r) => a + r.card, 0),
    enrol: list.reduce((a, r) => a + r.enrol, 0),
    amount: list.reduce((a, r) => a + r.amount, 0),
    sol: list.length > 0 ? list.reduce((a, r) => a + r.sol, 0) / list.length : 0,
    attempt: list.length > 0 ? list.reduce((a, r) => a + r.attempt, 0) / list.length : 0,
    durationSec: list.length > 0 ? list.reduce((a, r) => a + parseIntervalToSeconds(r.duration), 0) / list.length : 0,
    bunga0: list.reduce((a, r) => a + r.bunga0Pct * r.amount, 0),
    bungaReg: list.reduce((a, r) => a + r.bungaRegPct * r.amount, 0),
    target: list.reduce((a, r) => a + r.target, 0),
    gap: list.reduce((a, r) => a + r.gap, 0),
  });
  const infiniteTotal = teamTotal(infiniteTeamRows);
  const platinumTotal = teamTotal(platinumTeamRows);
 
  const totalCard = rows.reduce((a, r) => a + r.card, 0);
  const totalEnrol = rows.reduce((a, r) => a + r.enrol, 0);
  const totalAmount = rows.reduce((a, r) => a + r.amount, 0);
  const totalAgentCount = rows.reduce((a, r) => a + r.agentCount, 0);
  const totalTarget = rows.reduce((a, r) => a + r.target, 0);
  const totalGap = totalAmount - totalTarget;
  const totalBunga0 = rows.reduce((a, r) => a + r.bunga0Pct * r.amount, 0);
  const totalBungaReg = rows.reduce((a, r) => a + r.bungaRegPct * r.amount, 0);
 
  return {
    selectedDate,
    rows,
    totalCard,
    totalEnrol,
    totalAmount,
    totalAgentCount,
    totalTarget,
    totalGap,
    totalBunga0,
    totalBungaReg,
    infiniteTeamRows,
    platinumTeamRows,
    infiniteTotal,
    platinumTotal,
    targetPerAgentInfinite: agentTargetMap.get("INFINITE") ?? 0,
    targetPerAgentPlatinum: agentTargetMap.get("PLATINUM") ?? 0,
  };
} 