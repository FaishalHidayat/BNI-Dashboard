import { prisma } from "./prisma";
import { getResumeData } from "../app/resume/data";

export type ItkCountInfo = {
  count: number;
  source: "input" | "auto" | "default";
  auto: number; // jumlah agent otomatis dari Resume Agent
};

/**
 * Jumlah agent ITK per bulan ("YYYY-MM").
 * - Ada input manual: pakai angka input ("input").
 * - Tidak ada input: pakai jumlah agent di Resume Agent ("auto").
 * - Resume Agent juga kosong: pakai fallback ("default").
 */
export async function getItkAgentCounts(months: string[], fallback: number) {
  const [rows, resumes] = await Promise.all([
    prisma.itk_agent_count.findMany(),
    Promise.all(months.map((ym) => getResumeData(ym))),
  ]);
  const explicit = new Map(rows.map((r) => [r.period_month.toISOString().slice(0, 7), r.agent_count]));

  const result = new Map<string, ItkCountInfo>();
  months.forEach((ym, i) => {
    const auto = resumes[i].rows.length;
    const exact = explicit.get(ym);
    if (exact !== undefined) result.set(ym, { count: exact, source: "input", auto });
    else if (auto > 0) result.set(ym, { count: auto, source: "auto", auto });
    else result.set(ym, { count: fallback, source: "default", auto });
  });
  return result;
}