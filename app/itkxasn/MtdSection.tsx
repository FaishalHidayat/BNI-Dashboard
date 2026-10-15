import { prisma } from "../../lib/prisma";
import { getItkAgentCounts } from "../../lib/itkAgentCount";
import MtdChart from "./MtdChart";
import { getAsnAgentCounts } from "../../lib/asnAgentCount";

const REPORT_TYPE = "QC_CLOS";
const DAY_MS = 86_400_000;
const MAX_DAYS = 366;

type SearchParams = Record<string, string | string[] | undefined>;
type Src = "itk" | "asn";
type MainKind = "this" | "30" | "last" | "custom";
type CompKind = "prev" | "30" | "last" | "custom";
type Period = { start: string; end: string };

function first(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v;
}
function isDate(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + n);
  return toDateStr(d);
}
function diffDays(a: string, b: string) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / DAY_MS);
}
function monthStartOf(dateStr: string) {
  return dateStr.slice(0, 8) + "01";
}
// Bulan penuh sebelum bulan dari dateStr
function prevMonthRange(dateStr: string): Period {
  const end = addDays(monthStartOf(dateStr), -1);
  return { start: monthStartOf(end), end };
}
function dateLabel(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
function rangeLabel(p: Period) {
  return p.start === p.end ? dateLabel(p.start) : `${dateLabel(p.start)} – ${dateLabel(p.end)}`;
}
function monthName(ym: string) {
  return new Date(`${ym}-01`).toLocaleDateString("id-ID", { month: "short", year: "numeric", timeZone: "UTC" });
}

async function loadDaily(src: Src, p: Period): Promise<Map<string, number>> {
  const startDate = new Date(p.start);
  const endExclusive = new Date(addDays(p.end, 1));
  if (src === "itk") {
    const rows = await prisma.spv_daily.groupBy({
      by: ["report_date2"],
      where: { report_type2: REPORT_TYPE, report_date2: { gte: startDate, lt: endExclusive } },
      _sum: { sales_volume2: true },
    });
    return new Map(rows.map((r) => [toDateStr(r.report_date2), Number(r._sum.sales_volume2 ?? 0)]));
  }
  const rows = await prisma.asn_target.findMany({
    where: { report_date: { gte: startDate, lt: endExclusive } },
  });
  return new Map(rows.map((r) => [toDateStr(r.report_date), Number(r.sales_volume_asn)]));
}

// Akumulasi harian: indeks 0 = hari pertama periode
function cumulative(p: Period, daily: Map<string, number>): number[] {
  const len = Math.min(diffDays(p.start, p.end) + 1, MAX_DAYS);
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < len; i++) {
    acc += daily.get(addDays(p.start, i)) ?? 0;
    out.push(acc);
  }
  return out;
}

// Daftar bulan ("YYYY-MM") yang dilewati sebuah periode
function monthsIn(p: Period): string[] {
  const len = Math.min(diffDays(p.start, p.end) + 1, MAX_DAYS);
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    const ym = addDays(p.start, i).slice(0, 7);
    if (!out.includes(ym)) out.push(ym);
  }
  return out;
}

// Akumulasi rata-rata per agent: SV tiap hari dibagi jumlah agent pada bulan hari itu
function cumulativeAvg(p: Period, daily: Map<string, number>, countOn: (d: string) => number): number[] {
  const len = Math.min(diffDays(p.start, p.end) + 1, MAX_DAYS);
  const out: number[] = [];
  let acc = 0;
  for (let i = 0; i < len; i++) {
    const d = addDays(p.start, i);
    acc += (daily.get(d) ?? 0) / countOn(d);
    out.push(acc);
  }
  return out;
}

function pill(active: boolean) {
  return `text-sm px-3 py-1.5 rounded-lg border transition ${
    active
      ? "bg-slate-800 text-white border-slate-800"
      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
  }`;
}

export default async function MtdSection({
  searchParams,
  basePath = "/itkxasn",
}: {
  searchParams: SearchParams;
  basePath?: string;
}) {
  const sp = searchParams;

  // Anchor: tanggal data ITK terbaru
  const latest = await prisma.spv_daily.aggregate({
    where: { report_type2: REPORT_TYPE },
    _max: { report_date2: true },
  });
  const latestStr = latest._max.report_date2 ? toDateStr(latest._max.report_date2) : toDateStr(new Date());

  const src: Src = first(sp.mtdsrc) === "asn" ? "asn" : "itk";
  const mainKind: MainKind = (["this", "30", "last", "custom"] as const).find((k) => k === first(sp.mtdp)) ?? "this";
  const compKind: CompKind = (["prev", "30", "last", "custom"] as const).find((k) => k === first(sp.mtdc)) ?? "prev";

  const thisMonth: Period = { start: monthStartOf(latestStr), end: latestStr };
  const last30: Period = { start: addDays(latestStr, -29), end: latestStr };
  const lastMonth: Period = prevMonthRange(latestStr);

  function customPeriod(sKey: string, eKey: string, fallback: Period): Period {
    const s = first(sp[sKey]);
    const e = first(sp[eKey]);
    if (isDate(s) && isDate(e)) return s <= e ? { start: s, end: e } : { start: e, end: s };
    return fallback;
  }

  let main: Period;
  if (mainKind === "this") main = thisMonth;
  else if (mainKind === "30") main = last30;
  else if (mainKind === "last") main = lastMonth;
  else main = customPeriod("mtdps", "mtdpe", thisMonth);

  let comp: Period;
  if (compKind === "30") comp = last30;
  else if (compKind === "last") comp = lastMonth;
  else if (compKind === "custom") comp = customPeriod("mtdcs", "mtdce", lastMonth);
  else if (mainKind === "this" || mainKind === "last") comp = prevMonthRange(main.start);
  else {
    // Periode sebelumnya dengan panjang sama
    const len = diffDays(main.start, main.end) + 1;
    const end = addDays(main.start, -1);
    comp = { start: addDays(end, -(len - 1)), end };
  }

  // Pembagi rata-rata per agent
  // ITK: jumlah agent pada bulan tiap hari (dari Resume Agent). ASN: konfigurasi tetap.
  const config = await prisma.itkxasn_config.findFirst();
  const asnFallback = config?.agent_count_asn ?? 97;
  const itkFallback = config?.agent_count_itk ?? 79; // hanya dipakai kalau bulan itu belum punya data agent

  const months = Array.from(new Set([...monthsIn(main), ...monthsIn(comp)]));
  const countByMonth = new Map<string, number>();
  if (src === "itk") {
    const itkCounts = await getItkAgentCounts(months, itkFallback);
    itkCounts.forEach((v, ym) => countByMonth.set(ym, v.count));
  } else {
    const asnCounts = await getAsnAgentCounts(months, asnFallback);
    asnCounts.forEach((v, ym) => countByMonth.set(ym, v.count));
  }
  function agentCountOn(dateStr: string) {
    return countByMonth.get(dateStr.slice(0, 7)) ?? (src === "asn" ? asnFallback : itkFallback);
  }

  const [mainDaily, compDaily] = await Promise.all([loadDaily(src, main), loadDaily(src, comp)]);

  const mainCum = cumulative(main, mainDaily);
  const compCum = cumulative(comp, compDaily);
  const mainAvgCum = cumulativeAvg(main, mainDaily, agentCountOn);
  const compAvgCum = cumulativeAvg(comp, compDaily, agentCountOn);
  const maxLen = Math.max(mainCum.length, compCum.length);

  const totalData = Array.from({ length: maxLen }, (_, i) => ({
    day: i + 1,
    main: i < mainCum.length ? mainCum[i] : null,
    comp: i < compCum.length ? compCum[i] : null,
  }));
  const avgData = Array.from({ length: maxLen }, (_, i) => ({
    day: i + 1,
    main: i < mainAvgCum.length ? mainAvgCum[i] : null,
    comp: i < compAvgCum.length ? compAvgCum[i] : null,
  }));

  const agentNote = Array.from(countByMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ym, n]) => `${monthName(ym)}: ${n}`)
    .join(", ");
   

  const mainName = { this: "This Month", "30": "Last 30 Day", last: "Last Month", custom: "Custom" }[mainKind];
  const compName = { prev: "Previous", "30": "Last 30 Day", last: "Last Month", custom: "Custom" }[compKind];
  const mainLabel = `${mainName} (${rangeLabel(main)})`;
  const compLabel = `${compName} (${rangeLabel(comp)})`;
  const srcLabel = src === "itk" ? "ITK" : "ASN";

  function buildHref(overrides: Record<string, string | null>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) {
      const val = first(v);
      if (val !== undefined && val !== "") qs.set(k, val);
    }
    for (const [k, v] of Object.entries(overrides)) {
      if (v === null) qs.delete(k);
      else qs.set(k, v);
    }
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  }
  function hiddenInputs(exclude: string[]) {
    return Object.entries(sp).flatMap(([k, v]) => {
      const val = first(v);
      if (exclude.includes(k) || val === undefined || val === "") return [];
      return [<input key={k} type="hidden" name={k} value={val} />];
    });
  }

  const mainOptions: { key: MainKind; label: string }[] = [
    { key: "this", label: "This Month" },
    { key: "30", label: "Last 30 Day" },
    { key: "last", label: "Last Month" },
    { key: "custom", label: "Custom" },
  ];
  const compOptions: { key: CompKind; label: string }[] = [
    { key: "prev", label: "Previous" },
    { key: "30", label: "Last 30 Day" },
    { key: "last", label: "Last Month" },
    { key: "custom", label: "Custom" },
  ];

  return (
    <section className="mb-2">
      <div className="mb-4 bg-white p-3 rounded-xl shadow-sm border border-slate-200 flex flex-col gap-3 w-fit max-w-full">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 w-28">Sumber:</span>
          <a href={buildHref({ mtdsrc: "itk" })} className={pill(src === "itk")}>ITK</a>
          <a href={buildHref({ mtdsrc: "asn" })} className={pill(src === "asn")}>ASN</a>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 w-28">Periode:</span>
          {mainOptions.map((o) => (
            <a
              key={o.key}
              href={buildHref({ mtdp: o.key, ...(o.key === "custom" ? {} : { mtdps: null, mtdpe: null }) })}
              className={pill(mainKind === o.key)}
            >
              {o.label}
            </a>
          ))}
          {mainKind === "custom" && (
            <form action={basePath} method="GET" className="flex flex-wrap items-center gap-2 sm:pl-2">
              {hiddenInputs(["mtdp", "mtdps", "mtdpe"])}
              <input type="hidden" name="mtdp" value="custom" />
              <input type="date" name="mtdps" defaultValue={main.start} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
              <span className="text-sm text-slate-500">s/d</span>
              <input type="date" name="mtdpe" defaultValue={main.end} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg transition">
                Terapkan
              </button>
            </form>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-600 w-28">Bandingkan dengan:</span>
          {compOptions.map((o) => (
            <a
              key={o.key}
              href={buildHref({ mtdc: o.key, ...(o.key === "custom" ? {} : { mtdcs: null, mtdce: null }) })}
              className={pill(compKind === o.key)}
            >
              {o.label}
            </a>
          ))}
          {compKind === "custom" && (
            <form action={basePath} method="GET" className="flex flex-wrap items-center gap-2 sm:pl-2">
              {hiddenInputs(["mtdc", "mtdcs", "mtdce"])}
              <input type="hidden" name="mtdc" value="custom" />
              <input type="date" name="mtdcs" defaultValue={comp.start} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
              <span className="text-sm text-slate-500">s/d</span>
              <input type="date" name="mtdce" defaultValue={comp.end} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg transition">
                Terapkan
              </button>
            </form>
          )}
        </div>
      </div>

      <MtdChart
        title={`MTD vs Previous — Rata-rata SV per Agent ${srcLabel} (Akumulatif)`}
        data={avgData}
        mainLabel={mainLabel}
        compLabel={compLabel}
      />
      <MtdChart
        title={`MTD vs Previous — Total SV ${srcLabel} (Akumulatif)`}
        data={totalData}
        mainLabel={mainLabel}
        compLabel={compLabel}
      />
      <p className="text-xs text-slate-500 mb-6">
        Sumbu X adalah hari ke-N sejak tanggal awal masing-masing periode. Rata-rata per agent dihitung per hari: SV hari itu
        dibagi jumlah agent pada bulan hari tersebut, lalu diakumulasi. Jumlah agent: {agentNote}.
      </p>
    </section>
  );
}