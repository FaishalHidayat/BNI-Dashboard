import { getDailyBniData, dateLabelShort, formatSecondsToInterval, parseIntervalToSeconds } from "./data";
import PrintButton from "../components/PrintButton";

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

type Data = Awaited<ReturnType<typeof getDailyBniData>>;
type SpvRow = Data["rows"][number];
type TeamRow = Data["infiniteTeamRows"][number];

type SpvSortKey = "spvName" | "agentCount" | "card" | "enrol" | "amount" | "sol" | "attempt" | "bunga0Pct" | "bungaRegPct" | "gap";
type TeamSortKey = "spvName" | "name" | "card" | "enrol" | "amount" | "sol" | "attempt" | "bunga0Pct" | "bungaRegPct" | "gap";

const SPV_LABELS: Record<SpvSortKey, string> = {
  spvName: "SPV Name",
  agentCount: "Jumlah Agent",
  card: "Card",
  enrol: "Enrol",
  amount: "Amount",
  sol: "SOL",
  attempt: "Attempt",
  bunga0Pct: "Bunga 0%",
  bungaRegPct: "Bunga Regular",
  gap: "Gap",
};
const TEAM_LABELS: Record<TeamSortKey, string> = {
  spvName: "SPV Name",
  name: "Name",
  card: "Card",
  enrol: "Enrol",
  amount: "Amount",
  sol: "SOL",
  attempt: "Attempt",
  bunga0Pct: "Bunga 0%",
  bungaRegPct: "Bunga Regular",
  gap: "Gap",
};

function compareMulti<T extends Record<string, unknown>>(a: T, b: T, keys: string[], dirs: ("asc" | "desc")[]) {
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

export default async function DailyBniPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; q?: string; sort?: string; dir?: string; tsort?: string; tdir?: string }>;
}) {
  const params = await searchParams;
  const data = await getDailyBniData(params.date);
  const { selectedDate, totalTarget } = data;

  const q = (params.q ?? "").trim().toLowerCase();
  const sortKeys = (params.sort ? params.sort.split(",").filter(Boolean) : []) as SpvSortKey[];
  const sortDirs = (params.dir ? params.dir.split(",") : []) as ("asc" | "desc")[];
  const tSortKeys = (params.tsort ? params.tsort.split(",").filter(Boolean) : []) as TeamSortKey[];
  const tSortDirs = (params.tdir ? params.tdir.split(",") : []) as ("asc" | "desc")[];

  // --- SPV summary: filter + sort ---
  const filteredSpvRows = q ? data.rows.filter((r) => (r.spvName ?? "").toLowerCase().includes(q)) : data.rows;
  const sortedSpvRows = [...filteredSpvRows];
  if (sortKeys.length > 0) sortedSpvRows.sort((a, b) => compareMulti(a as SpvRow, b as SpvRow, sortKeys, sortDirs));

  const spvTotal = sortedSpvRows.reduce(
    (acc, r) => ({
      agentCount: acc.agentCount + r.agentCount,
      card: acc.card + r.card,
      enrol: acc.enrol + r.enrol,
      amount: acc.amount + r.amount,
      bunga0: acc.bunga0 + r.bunga0Pct * r.amount,
      bungaReg: acc.bungaReg + r.bungaRegPct * r.amount,
      target: acc.target + r.target,
      gap: acc.gap + r.gap,
    }),
    { agentCount: 0, card: 0, enrol: 0, amount: 0, bunga0: 0, bungaReg: 0, target: 0, gap: 0 }
  );

  // --- Team tables: filter + sort (dipakai bersama untuk Infinite & Platinum) ---
  function processTeam(list: TeamRow[]) {
    const filtered = q ? list.filter((r) => (r.name ?? "").toLowerCase().includes(q) || (r.spvName ?? "").toLowerCase().includes(q)) : list;
    const sorted = [...filtered];
    if (tSortKeys.length > 0) sorted.sort((a, b) => compareMulti(a, b, tSortKeys, tSortDirs));
    else sorted.sort((a, b) => b.amount - a.amount); // default: Amount besar -> kecil

    const total = sorted.reduce(
      (acc, r) => ({
        card: acc.card + r.card,
        enrol: acc.enrol + r.enrol,
        amount: acc.amount + r.amount,
        sol: acc.sol + r.sol,
        attempt: acc.attempt + r.attempt,
        durationSec: acc.durationSec + parseIntervalToSeconds(r.duration),
        bunga0: acc.bunga0 + r.bunga0Pct * r.amount,
        bungaReg: acc.bungaReg + r.bungaRegPct * r.amount,
        gap: acc.gap + r.gap,
      }),
      { card: 0, enrol: 0, amount: 0, sol: 0, attempt: 0, durationSec: 0, bunga0: 0, bungaReg: 0, gap: 0 }
    );
    const n = sorted.length || 1;
    return { sorted, total: { ...total, sol: total.sol / n, attempt: total.attempt / n, durationSec: total.durationSec / n } };
  }
  const infiniteProcessed = processTeam(data.infiniteTeamRows);
  const platinumProcessed = processTeam(data.platinumTeamRows);

  const teams = [
    { title: "INFINITE TEAM", ...infiniteProcessed, targetPerAgent: data.targetPerAgentInfinite },
    { title: "PLATINUM TEAM", ...platinumProcessed, targetPerAgent: data.targetPerAgentPlatinum },
  ];

  function baseQs() {
    const qs = new URLSearchParams();
    qs.set("date", selectedDate);
    if (q) qs.set("q", q);
    return qs;
  }

  function spvSortLink(key: SpvSortKey, label: string) {
    const idx = sortKeys.indexOf(key);
    const newKeys = [...sortKeys];
    const newDirs = [...sortDirs];
    if (idx === -1) {
      newKeys.push(key);
      newDirs.push("desc");
    } else {
      newDirs[idx] = newDirs[idx] === "desc" ? "asc" : "desc";
    }
    const qs = baseQs();
    qs.set("sort", newKeys.join(","));
    qs.set("dir", newDirs.join(","));
    if (tSortKeys.length > 0) qs.set("tsort", tSortKeys.join(","));
    if (tSortDirs.length > 0) qs.set("tdir", tSortDirs.join(","));
    const arrow = idx === -1 ? "" : sortDirs[idx] === "desc" ? " ▼" : " ▲";
    const order = idx === -1 ? "" : ` (${idx + 1})`;
    return (
      <a href={`/dailybni?${qs.toString()}`} className="hover:underline">
        {label}
        {arrow}
        {order}
      </a>
    );
  }

  function teamSortLink(key: TeamSortKey, label: string) {
    const idx = tSortKeys.indexOf(key);
    const newKeys = [...tSortKeys];
    const newDirs = [...tSortDirs];
    if (idx === -1) {
      newKeys.push(key);
      newDirs.push("desc");
    } else {
      newDirs[idx] = newDirs[idx] === "desc" ? "asc" : "desc";
    }
    const qs = baseQs();
    if (sortKeys.length > 0) qs.set("sort", sortKeys.join(","));
    if (sortDirs.length > 0) qs.set("dir", sortDirs.join(","));
    qs.set("tsort", newKeys.join(","));
    qs.set("tdir", newDirs.join(","));
    const arrow = idx === -1 ? "" : tSortDirs[idx] === "desc" ? " ▼" : " ▲";
    const order = idx === -1 ? "" : ` (${idx + 1})`;
    return (
      <a href={`/dailybni?${qs.toString()}`} className="hover:underline">
        {label}
        {arrow}
        {order}
      </a>
    );
  }

  const hasAnyFilter = Boolean(q || sortKeys.length > 0 || tSortKeys.length > 0);

  return (
    <main className="min-h-screen bg-slate-50 p-6 print:bg-white print:p-0">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between print:mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Daily BNI</h1>
            <p className="text-slate-500 text-sm">
              Kumulatif 1 – {dateLabelShort(selectedDate)} · Target Total {fmtRp(totalTarget)}
            </p>
          </div>
          <div className="flex items-center gap-2 print:hidden">
            <a
              href={`/api/export/dailybni?date=${selectedDate}`}
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
          <label htmlFor="date" className="text-sm text-slate-600">Tanggal (ASOF):</label>
          <input type="date" id="date" name="date" defaultValue={selectedDate} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
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
          {tSortKeys.length > 0 && <input type="hidden" name="tsort" value={tSortKeys.join(",")} />}
          {tSortDirs.length > 0 && <input type="hidden" name="tdir" value={tSortDirs.join(",")} />}
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Tampilkan
          </button>
          {hasAnyFilter && (
            <a href={`/dailybni?date=${selectedDate}`} className="text-xs text-blue-600 hover:underline ml-1">
              Reset filter/sort
            </a>
          )}
        </form>

        {sortKeys.length > 0 && (
          <p className="text-xs text-slate-500 mb-1 print:hidden">
            Sort Ringkasan SPV: {sortKeys.map((k, i) => `${SPV_LABELS[k]} (${sortDirs[i] === "asc" ? "kecil→besar" : "besar→kecil"})`).join(" → ")}
          </p>
        )}
        {tSortKeys.length > 0 && (
          <p className="text-xs text-slate-500 mb-4 print:hidden">
            Sort Team: {tSortKeys.map((k, i) => `${TEAM_LABELS[k]} (${tSortDirs[i] === "asc" ? "kecil→besar" : "besar→kecil"})`).join(" → ")}
          </p>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print:border-0 print:shadow-none">
          <table className="w-full text-sm border-collapse min-w-[1500px] print:min-w-0 print:text-xs">
            <thead className="bg-slate-800 text-white sticky top-0 print:bg-slate-200 print:text-black">
              <tr>
                <th className="p-3 text-left font-medium">Level</th>
                <th className="p-3 text-left font-medium">{spvSortLink("spvName", "SPV Name")}</th>
                <th className="p-3 text-left font-medium">User ID</th>
                <th className="p-3 text-right font-medium">{spvSortLink("agentCount", "Jumlah Agent")}</th>
                <th className="p-3 text-right font-medium">{spvSortLink("card", "Card")}</th>
                <th className="p-3 text-right font-medium">{spvSortLink("enrol", "Enrol")}</th>
                <th className="p-3 text-right font-medium">{spvSortLink("amount", "Amount")}</th>
                <th className="p-3 text-right font-medium">HK ASOF</th>
                <th className="p-3 text-right font-medium">Average/Day</th>
                <th className="p-3 text-right font-medium">{spvSortLink("sol", "SOL")}</th>
                <th className="p-3 text-right font-medium">Call Duration</th>
                <th className="p-3 text-right font-medium">{spvSortLink("attempt", "Attempt")}</th>
                <th className="p-3 text-right font-medium">{spvSortLink("bunga0Pct", "Bunga 0%")}</th>
                <th className="p-3 text-right font-medium">{spvSortLink("bungaRegPct", "Bunga Regular")}</th>
                <th className="p-3 text-right font-medium">Target</th>
                <th className="p-3 text-right font-medium">{spvSortLink("gap", "Gap")}</th>
              </tr>
            </thead>
            <tbody>
              {sortedSpvRows.map((r, idx) => (
                <tr key={r.userId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5 text-slate-500">{(r.level ?? "").toUpperCase()}</td>
                  <td className="p-2.5 text-slate-800 font-medium">{r.spvName}</td>
                  <td className="p-2.5 font-mono text-xs text-slate-600">{r.userId}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.agentCount)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.card)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.enrol)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.amount)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt(r.hkAsof)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.avgPerDay)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt2(r.sol)}</td>
                  <td className="p-2.5 text-right tabular-nums font-mono text-xs">{r.duration}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmt2(r.attempt)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtPct(r.bunga0Pct)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtPct(r.bungaRegPct)}</td>
                  <td className="p-2.5 text-right tabular-nums">{fmtRp(r.target)}</td>
                  <td className={`p-2.5 text-right tabular-nums font-semibold ${r.gap >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmtRp(r.gap)}
                  </td>
                </tr>
              ))}
              {sortedSpvRows.length === 0 && (
                <tr>
                  <td colSpan={16} className="p-4 text-center text-slate-400">Tidak ada SPV yang cocok.</td>
                </tr>
              )}
              <tr className="bg-slate-800 text-white font-bold print:bg-slate-300 print:text-black">
                <td className="p-3" colSpan={3}>TOTAL</td>
                <td className="p-3 text-right tabular-nums">{fmt(spvTotal.agentCount)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(spvTotal.card)}</td>
                <td className="p-3 text-right tabular-nums">{fmt(spvTotal.enrol)}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(spvTotal.amount)}</td>
                <td className="p-3" colSpan={3}></td>
                <td className="p-3" colSpan={1}></td>
                <td className="p-3" colSpan={1}></td>
                <td className="p-3 text-right tabular-nums">{spvTotal.amount > 0 ? fmtPct(spvTotal.bunga0 / spvTotal.amount) : "-"}</td>
                <td className="p-3 text-right tabular-nums">{spvTotal.amount > 0 ? fmtPct(spvTotal.bungaReg / spvTotal.amount) : "-"}</td>
                <td className="p-3 text-right tabular-nums">{fmtRp(spvTotal.target)}</td>
                <td className={`p-3 text-right tabular-nums ${spvTotal.gap >= 0 ? "text-green-300" : "text-red-300"}`}>{fmtRp(spvTotal.gap)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {teams.map((team) => (
          <div key={team.title} className="mt-8 print:break-before-page">
            <h2 className="text-lg font-bold text-slate-800 mb-1">{team.title}</h2>
            <p className="text-slate-500 text-sm mb-3">
              Target per Agent: {fmtRp(team.targetPerAgent)} · Kumulatif 1 – {dateLabelShort(selectedDate)}
            </p>
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto print:border-0 print:shadow-none">
              <table className="w-full text-sm border-collapse min-w-[1400px] print:min-w-0 print:text-xs">
                <thead className="bg-slate-800 text-white sticky top-0 print:bg-slate-200 print:text-black">
                  <tr>
                    <th className="p-3 text-left font-medium">No</th>
                    <th className="p-3 text-left font-medium">{teamSortLink("spvName", "SPV Name")}</th>
                    <th className="p-3 text-left font-medium">User ID</th>
                    <th className="p-3 text-left font-medium">{teamSortLink("name", "Name")}</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("card", "Card")}</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("enrol", "Enrol")}</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("amount", "Amount")}</th>
                    <th className="p-3 text-right font-medium">HK ASOF</th>
                    <th className="p-3 text-right font-medium">Average/Day</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("sol", "SOL")}</th>
                    <th className="p-3 text-right font-medium">Call Duration</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("attempt", "Attempt")}</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("bunga0Pct", "Bunga 0%")}</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("bungaRegPct", "Bunga Regular")}</th>
                    <th className="p-3 text-right font-medium">{teamSortLink("gap", "Gap")}</th>
                  </tr>
                </thead>
                <tbody>
                  {team.sorted.map((r, idx) => (
                    <tr key={r.userId} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                      <td className="p-2.5">{idx + 1}</td>
                      <td className="p-2.5 text-slate-500">{r.spvName}</td>
                      <td className="p-2.5 font-mono text-xs text-slate-600">{r.userId}</td>
                      <td className="p-2.5 text-slate-800">{r.name}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(r.card)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(r.enrol)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtRp(r.amount)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt(r.hkAsof)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtRp(r.avgPerDay)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt2(r.sol)}</td>
                      <td className="p-2.5 text-right tabular-nums font-mono text-xs">{r.duration}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmt2(r.attempt)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtPct(r.bunga0Pct)}</td>
                      <td className="p-2.5 text-right tabular-nums">{fmtPct(r.bungaRegPct)}</td>
                      <td className={`p-2.5 text-right tabular-nums font-semibold ${r.gap >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {fmtRp(r.gap)}
                      </td>
                    </tr>
                  ))}
                  {team.sorted.length === 0 && (
                    <tr>
                      <td colSpan={15} className="p-4 text-center text-slate-400">Tidak ada agent yang cocok.</td>
                    </tr>
                  )}
                  <tr className="bg-slate-800 text-white font-bold print:bg-slate-300 print:text-black">
                    <td className="p-3" colSpan={4}>TOTAL</td>
                    <td className="p-3 text-right tabular-nums">{fmt(team.total.card)}</td>
                    <td className="p-3 text-right tabular-nums">{fmt(team.total.enrol)}</td>
                    <td className="p-3 text-right tabular-nums">{fmtRp(team.total.amount)}</td>
                    <td className="p-3" colSpan={1}></td>
                    <td className="p-3" colSpan={1}></td>
                    <td className="p-3 text-right tabular-nums">{fmt2(team.total.sol)}</td>
                    <td className="p-3 text-right tabular-nums font-mono text-xs">{formatSecondsToInterval(team.total.durationSec)}</td>
                    <td className="p-3 text-right tabular-nums">{fmt2(team.total.attempt)}</td>
                    <td className="p-3 text-right tabular-nums">
                      {team.total.amount > 0 ? fmtPct(team.total.bunga0 / team.total.amount) : "-"}
                    </td>
                    <td className="p-3 text-right tabular-nums">
                      {team.total.amount > 0 ? fmtPct(team.total.bungaReg / team.total.amount) : "-"}
                    </td>
                    <td className={`p-3 text-right tabular-nums ${team.total.gap >= 0 ? "text-green-300" : "text-red-300"}`}>
                      {fmtRp(team.total.gap)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}