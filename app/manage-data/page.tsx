import { prisma } from "../../lib/prisma";
import type { Prisma } from "@prisma/client";
import ConfirmForm from "./ConfirmForm";
import {
  deleteAgRow,
  deleteSpvRow,
  deleteCdRow,
  deleteMappingRow,
  deleteAgBulk,
  deleteSpvBulk,
  deleteCdBulk,
  deleteMappingBulk,
} from "./actions";
 
function fmt(n: number | null | undefined) {
  return new Intl.NumberFormat("id-ID").format(Number(n ?? 0));
}
 
type Table = "ag" | "spv" | "cd" | "mapping";
 
export default async function ManageDataPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: Table; date?: string }>;
}) {
  const params = await searchParams;
  const table = params.table ?? "ag";
  const date = params.date ?? "";
 
  let agRows: Awaited<ReturnType<typeof prisma.ag_daily.findMany>> = [];
  let spvRows: Awaited<ReturnType<typeof prisma.spv_daily.findMany>> = [];
  let cdRows: Awaited<ReturnType<typeof prisma.cd_daily.findMany>> = [];
  let mappingRows: Prisma.agent_spv_mappingGetPayload<{ include: { agent: true } }>[] = [];
 
  if (date) {
    if (table === "ag") {
      agRows = await prisma.ag_daily.findMany({ where: { report_date: new Date(date) }, orderBy: { user_id: "asc" } });
    } else if (table === "spv") {
      spvRows = await prisma.spv_daily.findMany({ where: { report_date2: new Date(date) }, orderBy: { user_id2: "asc" } });
    } else if (table === "cd") {
      cdRows = await prisma.cd_daily.findMany({ where: { report_date3: new Date(date) }, orderBy: { user_id3: "asc" } });
    } else if (table === "mapping") {
      mappingRows = await prisma.agent_spv_mapping.findMany({
        where: { period_month: new Date(`${date.slice(0, 7)}-01T00:00:00.000Z`) },
        include: { agent: true },
        orderBy: [{ spv_name: "asc" }, { user_id4: "asc" }],
      });
    }
  }
 
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Kelola & Hapus Data</h1>
            <p className="text-slate-500 text-sm">Cari data yang salah, hapus per baris, atau hapus massal per tanggal/bulan.</p>
          </div>
        </div>
 
        {/* Pencarian */}
        <form method="GET" className="mb-6 flex flex-wrap items-center gap-2 bg-white p-4 rounded-xl shadow-sm border border-slate-200 w-fit">
          <label className="text-sm text-slate-600">Tabel:</label>
          <select name="table" defaultValue={table} className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm">
            <option value="ag">AG (ag_daily)</option>
            <option value="spv">SPV (spv_daily)</option>
            <option value="cd">CD (cd_daily)</option>
            <option value="mapping">Mapping SPV-Agent</option>
          </select>
          <label className="text-sm text-slate-600">
            {table === "mapping" ? "Bulan:" : "Tanggal:"}
          </label>
          <input
            type={table === "mapping" ? "month" : "date"}
            name="date"
            defaultValue={date}
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Cari
          </button>
        </form>
 
        {/* Hapus massal */}
        {date && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-800 mb-2">
              Hapus SEMUA data {table.toUpperCase()} untuk {table === "mapping" ? `bulan ${date}` : `tanggal ${date}`}
            </p>
            <ConfirmForm
              action={
                table === "ag" ? deleteAgBulk : table === "spv" ? deleteSpvBulk : table === "cd" ? deleteCdBulk : deleteMappingBulk
              }
              confirmMessage={`PERINGATAN: Ini akan menghapus SEMUA baris ${table.toUpperCase()} untuk ${date}. Aksi ini tidak bisa dibatalkan. Lanjutkan?`}
              className="flex items-center gap-2"
            >
              <input
                type="hidden"
                name={
                  table === "ag" ? "report_date" : table === "spv" ? "report_date2" : table === "cd" ? "report_date3" : "period_month"
                }
                value={date}
              />
              <input
                type="text"
                required
                placeholder='Ketik "HAPUS" untuk konfirmasi'
                pattern="HAPUS"
                title='Ketik persis "HAPUS"'
                className="border border-red-300 rounded-lg px-3 py-1.5 text-sm"
              />
              <button type="submit" className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
                Hapus Massal
              </button>
            </ConfirmForm>
          </div>
        )}
 
        {/* Hasil pencarian + hapus per baris */}
        {!date && <p className="text-slate-400 text-sm">Pilih tabel & tanggal, lalu klik "Cari" untuk menampilkan data.</p>}
 
        {table === "ag" && agRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">User ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-right">Card</th>
                  <th className="p-3 text-right">Freq</th>
                  <th className="p-3 text-right">Sales Volume</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {agRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2.5">{r.report_type}</td>
                    <td className="p-2.5 font-mono text-xs">{r.user_id}</td>
                    <td className="p-2.5">{r.user_name}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(r.card_count)}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(r.freq)}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(Number(r.sales_volume))}</td>
                    <td className="p-2.5 text-right">
                      <ConfirmForm action={deleteAgRow} confirmMessage={`Hapus data ${r.user_name} (${r.user_id}) tanggal ${date}?`}>
                        <input type="hidden" name="report_type" value={r.report_type} />
                        <input type="hidden" name="report_date" value={date} />
                        <input type="hidden" name="user_id" value={r.user_id} />
                        <button type="submit" className="text-red-600 hover:underline text-xs">Hapus</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
 
        {table === "spv" && spvRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">User ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-right">Card</th>
                  <th className="p-3 text-right">Freq</th>
                  <th className="p-3 text-right">Sales Volume</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {spvRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2.5">{r.report_type2}</td>
                    <td className="p-2.5 font-mono text-xs">{r.user_id2}</td>
                    <td className="p-2.5">{r.user_name2}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(r.card_count2)}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(r.freq2)}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(Number(r.sales_volume2))}</td>
                    <td className="p-2.5 text-right">
                      <ConfirmForm action={deleteSpvRow} confirmMessage={`Hapus data ${r.user_name2} (${r.user_id2}) tanggal ${date}?`}>
                        <input type="hidden" name="report_type2" value={r.report_type2} />
                        <input type="hidden" name="report_date2" value={date} />
                        <input type="hidden" name="user_id2" value={r.user_id2} />
                        <button type="submit" className="text-red-600 hover:underline text-xs">Hapus</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
 
        {table === "cd" && cdRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3 text-left">User ID</th>
                  <th className="p-3 text-left">Name</th>
                  <th className="p-3 text-right">NSTS</th>
                  <th className="p-3 text-right">Clos</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {cdRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2.5 font-mono text-xs">{r.user_id3}</td>
                    <td className="p-2.5">{r.user_name3}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(r.nsts)}</td>
                    <td className="p-2.5 text-right tabular-nums">{fmt(r.clos)}</td>
                    <td className="p-2.5 text-right">
                      <ConfirmForm action={deleteCdRow} confirmMessage={`Hapus data ${r.user_name3} (${r.user_id3}) tanggal ${date}?`}>
                        <input type="hidden" name="report_date3" value={date} />
                        <input type="hidden" name="user_id3" value={r.user_id3} />
                        <button type="submit" className="text-red-600 hover:underline text-xs">Hapus</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
 
        {table === "mapping" && mappingRows.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-800 text-white">
                <tr>
                  <th className="p-3 text-left">SPV Name</th>
                  <th className="p-3 text-left">Agent User ID</th>
                  <th className="p-3 text-left">Agent Name</th>
                  <th className="p-3 text-left">Level</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {mappingRows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="p-2.5">{r.spv_name}</td>
                    <td className="p-2.5 font-mono text-xs">{r.user_id4}</td>
                    <td className="p-2.5">{r.agent.user_name}</td>
                    <td className="p-2.5">{r.level}</td>
                    <td className="p-2.5 text-right">
                      <ConfirmForm action={deleteMappingRow} confirmMessage={`Hapus mapping ${r.agent.user_name} (${r.user_id4}) bulan ${date}?`}>
                        <input type="hidden" name="user_id4" value={r.user_id4} />
                        <input type="hidden" name="period_month" value={date} />
                        <button type="submit" className="text-red-600 hover:underline text-xs">Hapus</button>
                      </ConfirmForm>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
 
        {date &&
          ((table === "ag" && agRows.length === 0) ||
            (table === "spv" && spvRows.length === 0) ||
            (table === "cd" && cdRows.length === 0) ||
            (table === "mapping" && mappingRows.length === 0)) && (
            <p className="text-slate-400 text-sm">Tidak ada data ditemukan.</p>
          )}
      </div>
    </main>
  );
}