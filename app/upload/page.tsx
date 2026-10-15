import { uploadCsv } from "./actions";
 
export default async function UploadPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; type?: string; success?: string; failed?: string; message?: string; faileditems?: string }>;
}) {
  const params = await searchParams;
 
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-800">Upload Data Harian</h1>
        </div>
 
        {params.status === "done" && (
          <div className="mb-4 p-4 rounded-xl bg-green-50 border border-green-200 text-green-800 text-sm">
            Upload selesai untuk data <strong>{params.type?.toUpperCase()}</strong> — {params.success} baris berhasil,{" "}
            {params.failed} baris gagal.
          </div>
        )}
        {params.faileditems && (
          <div className="mb-4 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
            <p className="font-semibold mb-1">Detail baris yang gagal (User ID / Tanggal — alasan):</p>
            <ul className="list-disc pl-4 space-y-0.5">
              {params.faileditems.split(" | ").map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}
        {params.status === "error" && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            {params.message ?? "Terjadi kesalahan saat upload."}
          </div>
        )}
 
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <form action={uploadCsv} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Jenis Data</label>
              <select name="type" required className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full">
                <option value="ag">AG (ag_daily)</option>
                <option value="spv">SPV (spv_daily)</option>
                <option value="cd">CD (cd_daily)</option>
                <option value="mapping">Mapping SPV-Agent Bulanan (agent_spv_mapping)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">File CSV</label>
              <input
                type="file"
                name="csvfile"
                accept=".csv"
                required
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm w-full"
              />
            </div>
            <button
              type="submit"
              className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-2 rounded-lg transition w-fit"
            >
              Upload & Import
            </button>
          </form>
        </div>
 
        <div className="mt-6 bg-white rounded-xl shadow-sm border border-slate-200 p-6 text-sm text-slate-600">
          <p className="font-semibold text-slate-800 mb-2">Format kolom CSV yang diharapkan:</p>
          <p className="mb-1"><strong>AG:</strong> report_type, report_date, user_id, user_name, card_count, freq, bunga_0, bunga_regular, sales_volume</p>
          <p className="mb-1"><strong>SPV:</strong> report_type2, report_date2, user_id2, user_name2, card_count2, freq2, bunga_02, bunga_regular2, sales_volume2</p>
          <p className="mb-1"><strong>CD:</strong> report_date3, user_id3, user_name3, nsts, new_count, fup, dec_count, ncn, npu, ruf, atmp, talktime, duration, aprv, rdpc, clos, sol, ar, er, tr_pct, scr_pct, s_c, dch, prd</p>
          <p><strong>Mapping SPV-Agent Bulanan:</strong> user_id4, spv_user_id, spv_name, level, period_month (format period_month: YYYY-MM, misal 2026-09)</p>
          <p className="mt-2 text-xs text-slate-400">
            Format tanggal: YYYY-MM-DD. Format talktime/duration: HH:MM:SS. Kalau data untuk tanggal & user yang sama sudah ada, otomatis di-update (bukan dobel).
          </p>
        </div>
      </div>
    </main>
  );
}