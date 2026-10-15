import { prisma } from "./prisma";

export type AsnCountInfo = { count: number; source: "input" | "carry" | "default" };

/**
 * Jumlah agent ASN per bulan ("YYYY-MM").
 * - Bulan yang sudah diinput: pakai angka itu.
 * - Bulan belum diinput: pakai input terakhir sebelum bulan itu ("carry").
 * - Belum ada input sama sekali sebelumnya: pakai fallback ("default").
 */
export async function getAsnAgentCounts(months: string[], fallback: number) {
  const rows = await prisma.asn_agent_count.findMany({ orderBy: { period_month: "asc" } });
  const explicit = new Map(rows.map((r) => [r.period_month.toISOString().slice(0, 7), r.agent_count]));
  const sortedKeys = Array.from(explicit.keys()).sort();

  const result = new Map<string, AsnCountInfo>();
  for (const m of months) {
    const exact = explicit.get(m);
    if (exact !== undefined) {
      result.set(m, { count: exact, source: "input" });
      continue;
    }
    let prev: string | undefined;
    for (const k of sortedKeys) {
      if (k < m) prev = k;
      else break;
    }
    if (prev) result.set(m, { count: explicit.get(prev)!, source: "carry" });
    else result.set(m, { count: fallback, source: "default" });
  }
  return result;
}