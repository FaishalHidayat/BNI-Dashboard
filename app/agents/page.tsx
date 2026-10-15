import { prisma } from "../../lib/prisma";
import { addAgent, addMapping } from "./actions";
import HideUnassignedToggle from "./HideUnassignedToggle";
 
function toMonthStart(monthStr: string) {
  return new Date(`${monthStr}-01T00:00:00.000Z`);
}
function currentMonthStr() {
  return new Date().toISOString().slice(0, 7);
}
 
export default async function AgentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonthStr();
  const monthStart = toMonthStart(month);
 
  // Semua agent yang pernah terdaftar
  const allAgents = await prisma.agent.findMany({ orderBy: { user_id: "asc" } });
 
  // Daftar SPV untuk dropdown — langsung dari tabel agent (role = SPV),
  // supaya SPV baru yang belum punya mapping sekalipun tetap muncul di sini.
  const knownSpvs = allAgents
    .filter((a) => a.role?.toUpperCase() === "SPV")
    .map((a) => ({ spv_user_id: a.user_id, spv_name: a.user_name, level: a.level }));
 
  // Mapping bulan yang dipilih
  const currentMappings = await prisma.agent_spv_mapping.findMany({
    where: { period_month: monthStart },
    include: { agent: true },
    orderBy: [{ spv_name: "asc" }, { user_id4: "asc" }],
  });
 
  const mappedIds = new Set(currentMappings.map((m) => m.user_id4));
  const spvIds = new Set(knownSpvs.map((s) => s.spv_user_id));
  const unassignedAgents = allAgents.filter(
    (a) => !mappedIds.has(a.user_id) && !spvIds.has(a.user_id) && a.role?.toUpperCase() !== "SPV"
  );
 
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kelola Agent & Rolling SPV</h1>
            <p className="text-slate-500 text-sm">Tambah agent baru & atur SPV yang membawahi tiap bulan</p>
          </div>
        </div>
 
        {/* Form 1: Tambah Agent Baru */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-3">1. Tambah / Update Data Agent</h2>
          <p className="text-xs text-slate-500 mb-4">
            Gunakan ini untuk mendaftarkan agent baru (misal pengganti agent yang keluar) ke sistem. Kalau User ID
            sudah ada, datanya akan di-update (bukan dobel).
          </p>
          <form action={addAgent} className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">User ID</label>
              <input name="user_id" required placeholder="Misal: F020" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama</label>
              <input name="user_name" required placeholder="Nama lengkap" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Role</label>
              <select name="role" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="AGENT">AGENT</option>
                <option value="SPV">SPV</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Level</label>
              <select name="level" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="INFINITE">INFINITE</option>
                <option value="PLATINUM">PLATINUM</option>
              </select>
            </div>
            <div className="md:col-span-4">
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg transition">
                Simpan Agent
              </button>
            </div>
          </form>
        </div>
 
        {/* Form 2: Assign ke SPV untuk bulan tertentu */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-3">2. Assign Agent ke SPV (per Bulan)</h2>
          <p className="text-xs text-slate-500 mb-4">
            Tentukan agent ini dibawahi SPV siapa untuk bulan tertentu. Kalau agent sudah punya assignment di bulan
            yang sama, otomatis di-update.
          </p>
          <form action={addMapping} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Agent</label>
              <select name="user_id4" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="">-- Pilih Agent --</option>
                {allAgents.map((a) => (
                  <option key={a.user_id} value={a.user_id}>
                    {a.user_id} — {a.user_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">SPV</label>
              <select
                name="spv_user_id"
                required
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
              >
                <option value="">-- Pilih SPV --</option>
                {knownSpvs.map((s) => (
                  <option key={s.spv_user_id} value={s.spv_user_id!}>
                    {s.spv_user_id} — {s.spv_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Nama SPV (persis)</label>
              <input
                name="spv_name"
                required
                placeholder="Samakan dgn nama SPV"
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Level Agent</label>
              <select name="level" className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="INFINITE">INFINITE</option>
                <option value="PLATINUM">PLATINUM</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Bulan</label>
              <input
                type="month"
                name="period_month"
                required
                defaultValue={month}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
              />
            </div>
            <div className="md:col-span-5">
              <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg transition">
                Simpan Assignment
              </button>
            </div>
          </form>
          <p className="text-xs text-amber-600 mt-2">
            Catatan: kolom &quot;Nama SPV&quot; harus diisi manual persis sama dengan nama yang sudah dipakai
            (lihat dropdown SPV di atas untuk contoh ejaannya) — ini dipakai sebagai label tampilan saja, pencocokan
            data tetap berdasarkan User ID.
          </p>
        </div>
 
        {/* Agent yang belum di-assign bulan ini */}
        {unassignedAgents.length > 0 && (
          <div className="mb-6">
            <div className="flex justify-end mb-1.5">
              <HideUnassignedToggle />
            </div>
            <div className="unassigned-warning bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <strong>{unassignedAgents.length} agent belum di-assign ke SPV untuk bulan {month}:</strong>{" "}
              {unassignedAgents.map((a) => `${a.user_id} (${a.user_name})`).join(", ")}
            </div>
          </div>
        )}
 
        {/* Tabel mapping bulan berjalan */}
        <div className="mb-3 flex items-center gap-2">
          <form method="GET" className="flex items-center gap-2">
            <label className="text-sm text-slate-600">Lihat bulan:</label>
            <input type="month" name="month" defaultValue={month} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm" />
            <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-3 py-1.5 rounded-lg transition">
              Tampilkan
            </button>
          </form>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-left font-medium">Level</th>
                <th className="p-3 text-left font-medium">SPV Name</th>
                <th className="p-3 text-left font-medium">SPV User ID</th>
                <th className="p-3 text-left font-medium">Agent User ID</th>
                <th className="p-3 text-left font-medium">Agent Name</th>
              </tr>
            </thead>
            <tbody>
              {currentMappings.map((m, idx) => (
                <tr key={m.id} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-2.5 text-slate-500">{m.level}</td>
                  <td className="p-2.5">{m.spv_name}</td>
                  <td className="p-2.5 font-mono text-xs text-slate-600">{m.spv_user_id}</td>
                  <td className="p-2.5 font-mono text-xs text-slate-600">{m.user_id4}</td>
                  <td className="p-2.5">{m.agent.user_name}</td>
                </tr>
              ))}
              {currentMappings.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-4 text-center text-slate-400">
                    Belum ada mapping untuk bulan ini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}