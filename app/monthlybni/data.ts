import { prisma } from "../../lib/prisma";
import { getResumeData } from "../resume/data";

const REPORT_TYPE = "QC_CLOS";

export function monthKey(d: Date) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
export function toMonthStart(monthStr: string) {
  return new Date(`${monthStr}-01T00:00:00.000Z`);
}
export function nextMonthStart(monthStr: string) {
  const d = toMonthStart(monthStr);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}
export function monthLabelShort(monthStr: string) {
  return toMonthStart(monthStr).toLocaleDateString("en-US", { month: "short", year: "2-digit", timeZone: "UTC" });
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

/** Daftar semua bulan yang punya data ag_daily (QC_CLOS), urut lama -> baru. */
export async function getAvailableMonths(): Promise<string[]> {
  const rows = await prisma.ag_daily.findMany({
    where: { report_type: REPORT_TYPE },
    select: { report_date: true },
    distinct: ["report_date"],
  });
  const set = new Set<string>();
  for (const r of rows) set.add(monthKey(r.report_date));
  return Array.from(set).sort();
}

export type FloorPerfRow = {
  month: string;
  salesVolume: number;
  avgDurationSeconds: number;
  avgDurationLabel: string;
};

/** Sengaja memakai getResumeData supaya rata-rata duration & sales volume
 *  persis sama dengan yang tampil di halaman Resume Agent (satu sumber kebenaran). */
export async function getFloorPerformanceData(months: string[]): Promise<FloorPerfRow[]> {
  const results: FloorPerfRow[] = [];

  for (const month of months) {
    const resume = await getResumeData(month);
    results.push({
      month,
      salesVolume: resume.grandSales,
      avgDurationSeconds: resume.grandDurationSeconds,
      avgDurationLabel: resume.grandDuration,
    });
  }

  return results;
}

/** bagian Floor Productivity bagian pertama */
export type ProductivityLevel = "INFINITE" | "PLATINUM";

const PRODUCTIVITY_THRESHOLDS: Record<ProductivityLevel, { high: number; middle: number }> = {
  INFINITE: { high: 1_800_000_000, middle: 1_200_000_000 },
  PLATINUM: { high: 1_200_000_000, middle: 800_000_000 },
};

function categorizeSales(level: ProductivityLevel, sales: number): "Low" | "Middle" | "High" {
  const t = PRODUCTIVITY_THRESHOLDS[level];
  if (sales >= t.high) return "High";
  if (sales >= t.middle) return "Middle";
  return "Low";
}

export type ProductivityChartRow = {
  category: "Low" | "Middle" | "High";
  [monthLabel: string]: number | string;
};

export type FloorProductivityData = {
  infinite: ProductivityChartRow[];
  platinum: ProductivityChartRow[];
};

/** Mengelompokkan jumlah agent per kategori (Low/Middle/High) per level per bulan,
 *  berdasarkan total Sales Volume bulanan masing-masing agent (dari getResumeData). */
export async function getFloorProductivityData(months: string[]): Promise<FloorProductivityData> {
  const categories: ("Low" | "Middle" | "High")[] = ["Low", "Middle", "High"];

  const infiniteCounts: Record<string, Record<string, number>> = { Low: {}, Middle: {}, High: {} };
  const platinumCounts: Record<string, Record<string, number>> = { Low: {}, Middle: {}, High: {} };

  for (const month of months) {
    const label = monthLabelShort(month);
    const resume = await getResumeData(month);

    for (const cat of categories) {
      infiniteCounts[cat][label] = 0;
      platinumCounts[cat][label] = 0;
    }

    for (const r of resume.rows) {
      const level = (r.level ?? "").toUpperCase();
      if (level !== "INFINITE" && level !== "PLATINUM") continue;
      const cat = categorizeSales(level as ProductivityLevel, r.sales);
      if (level === "INFINITE") {
        infiniteCounts[cat][label] = (infiniteCounts[cat][label] ?? 0) + 1;
      } else {
        platinumCounts[cat][label] = (platinumCounts[cat][label] ?? 0) + 1;
      }
    }
  }


  /** bagian Floor Productivity bagian kedua */
  const buildRows = (counts: Record<string, Record<string, number>>): ProductivityChartRow[] =>
    categories.map((cat) => ({ category: cat, ...counts[cat] }));

  return {
    infinite: buildRows(infiniteCounts),
    platinum: buildRows(platinumCounts),
  };
}

export type SolDurationRow = {
  monthLabel: string;
  ge: number;
  lt: number;
};

export type FloorProductivityPart2Data = {
  solicited: SolDurationRow[];
  callDuration: SolDurationRow[];
};

const SOL_THRESHOLD = 550;
const DURATION_THRESHOLD_SECONDS = 7 * 3600; // 7 jam

/** Menghitung jumlah agent di atas/bawah threshold SOL (>=550 / <550)
 *  dan threshold Call Duration (>=7 jam / <7 jam), per bulan, dari getResumeData. */
export async function getFloorProductivityPart2Data(months: string[]): Promise<FloorProductivityPart2Data> {
  const solicited: SolDurationRow[] = [];
  const callDuration: SolDurationRow[] = [];

  for (const month of months) {
    const label = monthLabelShort(month);
    const resume = await getResumeData(month);

    let solGe = 0;
    let solLt = 0;
    let durGe = 0;
    let durLt = 0;

    for (const r of resume.rows) {
      if (r.sol >= SOL_THRESHOLD) solGe++;
      else solLt++;

      const durationSeconds = parseIntervalToSeconds(r.duration);
      if (durationSeconds >= DURATION_THRESHOLD_SECONDS) durGe++;
      else durLt++;
    }

    solicited.push({ monthLabel: label, ge: solGe, lt: solLt });
    callDuration.push({ monthLabel: label, ge: durGe, lt: durLt });
  }

  return { solicited, callDuration };
}


/** bagian KPI Performance */
export type KpiRow = {
  month: string;
  monthLabel: string;
  businessDays: number;
  workingDaysAvg: number;
  totalAgent: number;
  totalCard: number;
  totalSalesVolume: number;
  agentProductivity: number;
  spendPerCard: number;
};

/** Target statis KPI 2025 — sesuai nilai di laporan referensi.
 *  businessDays & workingDays sengaja null karena baris itu tidak punya kolom KPI 2025 di referensi. */
export const KPI_2025_TARGET = {
  totalAgent: 92,
  totalCard: 10_000,
  totalSalesVolume: 200_000_000_000,
  agentProductivity: 5.4,
  spendPerCard: 19_197_719,
};

/** Business Days = jumlah hari unik yang punya data spv_daily pada bulan itu */

export async function getKpiPerformanceData(months: string[]): Promise<KpiRow[]> {
  const results: KpiRow[] = [];

  for (const month of months) {

    const resume = await getResumeData(month);

    const totalAgent = resume.rows.length;
    const totalCard = resume.grandCard;
    const totalSalesVolume = resume.grandSales;
    const workingDaysAvg =
      resume.rows.length > 0 ? resume.rows.reduce((a, r) => a + r.workingDays, 0) / resume.rows.length : 0;

    const agentProductivity =
      workingDaysAvg > 0 && totalAgent > 0 ? totalCard / workingDaysAvg / totalAgent : 0;
    const spendPerCard = totalCard > 0 ? totalSalesVolume / totalCard : 0;

    results.push({
      month,
      monthLabel: monthLabelShort(month),
      businessDays: workingDaysAvg,
      workingDaysAvg,
      totalAgent,
      totalCard,
      totalSalesVolume,
      agentProductivity,
      spendPerCard,
    });
  }

  return results;
}