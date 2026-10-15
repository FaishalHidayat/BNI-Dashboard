import { getResumeData, monthLabel, parseIntervalToSeconds, formatSecondsToInterval } from "./data";
import PrintButton from "../components/PrintButton";
import ProductivityScatter from "./ProductivityScatter";

function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
}
function fmt2(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2, minimumFractionDigits: 2 }).format(Number(n ?? 0));
}
function fmtRp(n: number | null | undefined) {
  return "Rp " + fmt(n);
}
function fmtPct(n: number | null | undefined) {
  return (Number(n ?? 0) * 100).toFixed(1) + "%";
}

type SortKey = "spvName" | "name" | "card" | "freq" | "sales" | "sol" | "attemptRatio" | "bunga0Pct" | "bungaRegPct";
type Row = Awaited<ReturnType<typeof getResumeData>>["rows"][number];

const SORT_LABELS: Record<SortKey, string> = {
  spvName: "SPV Name",
  name: "Name",
  card: "Card",
  freq: "Freq",
  sales: "Sales Volume",
  sol: "SOL",
  attemptRatio: "Attempt Ratio",
  bunga0Pct: "Bunga 0%",
  bungaRegPct: "Bunga Regular",
};

function compareMulti(a: Row, b: Row, keys: SortKey[], dirs: ("asc" | "desc")[]) {
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    const d = dirs[i] ?? "desc";
    const va = a[k];
    const vb = b[k];
    let cmp: number;
    if (typeof va === "string" && typeof vb === "string") {
      cmp = va.localeCompare(vb);
    } else {
      cmp = Number(va ?? 0) - Number(vb ?? 0);
    }
    if (d === "desc") cmp = -cmp;
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export default async function ResumeAgentPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; q?: string; sort?: string; dir?: string }>;
}) {
  const params = await searchParams;
  const { month, rows } = await getResumeData(params.month);

  const q = (params.q ?? "").trim().toLowerCase();
  const sortKeys = (params.sort ? params.sort.split(",").filter(Boolean) : []) as SortKey[];
  const sortDirs = (params.dir ? params.dir.split(",") : []) as ("asc" | "desc")[];

  const filteredRows = q
    ? rows.filter((r) => (r.name ?? "").toLowerCase().includes(q) || (r.spvName ?? "").toLowerCase().includes(q))
    : rows;

  const sortedRows = [...filteredRows];
  if (sortKeys.length > 0) {
    sortedRows.sort((a, b) => compareMulti(a, b, sortKeys, sortDirs));
  }

  // Total dihitung ulang dari baris yang sedang ditampilkan (ikut ke-filter)
  const grandCard = sortedRows.reduce((a, r) => a + r.card, 0);
  const grandFreq = sortedRows.reduce((a, r) => a + r.freq, 0);
  const grandSales = sortedRows.reduce((a, r) => a + r.sales, 0);
  const grandSol = sortedRows.reduce((a, r) => a + r.sol, 0);
  const grandAttemptRatio = sortedRows.length > 0 ? sortedRows.reduce((a, r) => a + r.attemptRatio, 0) / sortedRows.length : 0;
  const grandDurationSeconds =
    sortedRows.length > 0 ? sortedRows.reduce((a, r) => a + parseIntervalToSeconds(r.duration), 0) / sortedRows.length : 0;
  const grandDuration = formatSecondsToInterval(grandDurationSeconds);

  // Data scatter: semua agent yang punya data CD (working days > 0), tidak ikut ter-filter pencarian
  const scatterPoints = rows
    .filter((r) => r.workingDays > 0)
    .map((r) => ({
      id: r.userId,
      name: r.name ?? r.userId,
      level: (r.level ?? "-").toUpperCase(),
      sales: r.sales,
      sol: r.sol,
      durationHours: parseIntervalToSeconds(r.duration) / 3600,
    }));
  const excludedCount = rows.filter((r) => r.workingDays === 0).length;
  const highlightIds = q ? sortedRows.map((r) => r.userId) : null;


  function sortLink(key: SortKey, label: string) {
    const idx = sortKeys.indexOf(key);
    const newKeys = [...sortKeys];
    const newDirs = [...sortDirs];
    if (idx === -1) {
      newKeys.push(key);
      newDirs.push("desc");
    } else {
      newDirs[idx] = newDirs[idx] === "desc" ? "asc" : "desc";
    }
    const qs = new URLSearchParams();
    qs.set("month", month);
    if (q) qs.set("q", q);
    qs.set("sort", newKeys.join(","));
    qs.set("dir", newDirs.join(","));

    const activeIdx = sortKeys.indexOf(key);
    const arrow = activeIdx === -1 ? "" : sortDirs[activeIdx] === "desc" ? " ▼" : " ▲";
    const order = activeIdx === -1 ? "" : ` (${activeIdx + 1})`;

    return (
      <a href={`/resume?${qs.toString()}`} className="hover:underline">
        {label}
        {arrow}
        {order}
      </a>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between print:mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Resume Agent</h1>
            <p className="text-slate-500 text-sm">Rekap Bulanan — {monthLabel(month)}</p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <a
              href={`/api/export/resume?month=${month}`}
              className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm px-4 py-1.5 rounded-lg transition"
            >
              Download Excel
            </a>
            <PrintButton label="Print PDF" />
          </div>
        </div>

        <form
          method="GET"
          className="mb-2 flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit print:hidden"
        >
          <label htmlFor="month" className="text-sm text-slate-600">Bulan:</label>
          <input type="month" id="month" name="month" defaultValue={month} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
          <label htmlFor="q" className="text-sm text-slate-600 ml-2">Cari Nama/SPV:</label>
          <input
            type="text"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Ketik nama agent atau SPV..."
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-56"
          />
          {sortKeys.length > 0 && <input type="hidden" name="sort" value={sortKeys.join(",")} />}
          {sortDirs.length > 0 && <input type="hidden" name="dir" value={sortDirs.join(",")} />}
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
          {(q || sortKeys.length > 0) && (
            <a href={`/resume?month=${month}`} className="text-xs text-blue-600 hover:underline ml-1">
              Reset filter/sort
            </a>
          )}
        </form>

        {sortKeys.length > 0 && (
          <p className="text-xs text-slate-500 mb-4 print:hidden">
            Diurutkan berdasarkan: {sortKeys.map((k, i) => `${SORT_LABELS[k]} (${sortDirs[i] === "asc" ? "kecil→besar" : "besar→kecil"})`).join(" → ")}
          </p>
        )}

        <div className="mb-6 print:hidden">
          <ProductivityScatter
            points={scatterPoints}
            highlightIds={highlightIds}
            excluded={excludedCount}
            monthLabel={monthLabel(month)}
          />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print:border-0 print:shadow-none">
          <table className="w-full text-sm border-collapse min-w-[1300px] print:min-w-0 print:text-xs">
            <thead className="bg-slate-800 text-white sticky top-0 print:bg-slate-200 print:text-black">
              <tr>
                <th className="p-3 text-left font-medium">Level</th>
                <th className="p-3 text-left font-medium">{sortLink("spvName", "SPV Name")}</th>
                <th className="p-3 text-left font-medium">User ID</th>
                <th className="p-3 text-left font-medium">{sortLink("name", "Name")}</th>
                <th className="p-3 text-right font-medium">{sortLink("card", "Card")}</th>
                <th className="p-3 text-right font-medium">{sortLink("freq", "Freq")}</th>
                <th className="p-3 text-right font-medium">{sortLink("sales", "Sales Volume")}</th>
                <th className="p-3 text-right font-medium">Working Days</th>
                <th className="p-3 text-right font-medium">{sortLink("sol", "SOL")}</th>
                <th className="p-3 text-right font-medium">Duration</th>
                <th className="p-3 text-right font-medium">{sortLink("attemptRatio", "Attempt Ratio")}</th>
                <th className="p-3 text-right font-medium">{sortLink("bunga0Pct", "Bunga 0%")}</th>
                <th className="p-3 text-right font-medium">{sortLink("bungaRegPct", "Bunga Regular")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, idx) => (
                <tr key={r.userId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5 text-slate-500">{r.level}</td>
                  <td className="p-2.5 text-slate-500">{r.spvName}</td>
                  <td className="p-2.5 font-mono text-xs text-slate-600">{r.userId}</td>
                  <td className="p-2.5 text-slate-800">{r.name}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.card)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.freq)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.sales)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.workingDays)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt2(r.sol)}</td>
                  <td className="p-2.5 text-right tabular-nums font-mono text-xs">{r.duration}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt2(r.attemptRatio)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtPct(r.bunga0Pct)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtPct(r.bungaRegPct)}</td>
                </tr>
              ))}
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={13} className="p-4 text-center text-slate-400">Tidak ada agent yang cocok.</td>
                </tr>
              )}
              <tr className="bg-slate-800 text-white font-bold print:bg-slate-300 print:text-black">
                <td className="p-3" colSpan={4}>TOTAL KESELURUHAN</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandCard)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(grandFreq)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(grandSales)}</td>
                <td className="p-3"></td>
                <td className="p-3 text-right tabular-nums">{fmt2(grandSol)}</td>
                <td className="p-3 text-right tabular-nums font-mono text-xs">{grandDuration}</td>
                <td className="p-3 text-right tabular-nums">{fmt2(grandAttemptRatio)}</td>
                <td className="p-3" colSpan={2}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}