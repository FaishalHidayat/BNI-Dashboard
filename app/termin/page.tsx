const TERMS: { term: string; desc: string }[] = [
  { term: "CLOS", desc: "Jumlah kartu kredit yang berhasil di-closing, telah melalui dan lolos proses verifikasi QC (Quality Control), serta telah dicairkan oleh BNI." },
  { term: "RDPC", desc: "Re-dispatch, yaitu kartu kredit yang sebelumnya telah ditawarkan kepada customer, tetapi tidak lolos proses verifikasi QC sehingga dikembalikan kepada agent untuk diproses kembali." },
  { term: "CUST", desc: "Jumlah kartu kredit yang dimiliki oleh customer." },
  { term: "CD (Call Duration)", desc: "Durasi keseluruhan proses panggilan, yaitu waktu yang dihitung sejak agent mulai melakukan panggilan hingga panggilan berakhir." },
  { term: "NSTS", desc: "Jumlah data customer baru, yaitu data customer yang belum pernah dihubungi pada bulan berjalan." },
  { term: "New", desc: "Jumlah data customer yang digunakan kembali (reuse) atau statusnya diubah menjadi New setelah sebelumnya memiliki status seperti Decline, Reject Up Front, Not Answered, dan status lainnya." },
  { term: "FUP (Follow Up)", desc: "Data customer yang berhasil dihubungi, telah menerima penjelasan dan menunjukkan ketertarikan terhadap produk, tetapi masih membutuhkan waktu untuk mempertimbangkan penawaran." },
  { term: "DEC (Decline)", desc: "Data customer yang telah mendapatkan penjelasan mengenai produk, tetapi menyatakan menolak atau tidak tertarik terhadap penawaran." },
  { term: "NCN (Not Connected)", desc: "Data customer yang tidak berhasil tersambung sama sekali saat dilakukan upaya panggilan." },
  { term: "NPU (Nobody Pick Up)", desc: "Atau Not Contacted, Data customer yang nomor teleponnya tersambung, tetapi panggilan tidak diangkat oleh customer sehingga belum terjadi komunikasi dengan customer." },
  { term: "RUF (Reject Up Front)", desc: "Data customer yang langsung menolak penawaran sejak awal panggilan, sebelum agent memberikan penjelasan mengenai produk." },
  { term: "ATMP (Attempt)", desc: "Jumlah total percobaan yang dilakukan agent untuk menghubungi customer." },
  { term: "Talktime", desc: "Total durasi waktu percakapan antara agent dan customer setelah panggilan tersambung dan komunikasi berlangsung." },
  { term: "Duration", desc: "Total durasi panggilan yang dihitung sejak agent mulai melakukan panggilan hingga panggilan ditutup, yang mencakup ringing time dan talktime." },
  { term: "SOL (Solicited)", desc: "Jumlah data customer yang telah dilakukan penawaran atau solicitation oleh agent." },
  { term: "AR (Attempt Ratio)", desc: "Rasio antara jumlah attempt dengan jumlah data customer yang dihubungi. AR = Total Attempt ÷ Total Data." },
  { term: "S/C (Spend per Card)", desc: "Rata-rata Sales Volume untuk setiap kartu yang berhasil dicairkan. S/C = Sales Volume ÷ Jumlah Card." },
  { term: "CARD", desc: "Jumlah kartu kredit." },
  { term: "FREQ (Frequency)", desc: "Jumlah frekuensi transfer atau perpindahan kartu kredit. Maksimal satu kartu dapat mengalami 3 kali transfer." },
  { term: "BUNGA 0%", desc: "Menunjukkan penawaran atau fasilitas kartu kredit dengan rate bunga 0%. Nilai 0 menunjukkan apakah penawaran bunga 0% dapat ditawarkan atau tidak, sesuai dengan ketentuan atau eligibility yang berlaku." },
  { term: "Bunga Reguler", desc: "Bunga kartu kredit dengan rate selain 0%, sesuai dengan ketentuan bunga reguler yang berlaku." },
  { term: "Sales Volume", desc: "Total nilai limit kartu kredit yang berhasil dicairkan pada hari tersebut. Sales Volume merupakan nilai pencairan yang dihasilkan dari kartu kredit yang berhasil diproses." },
  { term: "Enrol", desc: "Jumlah frekuensi transfer kartu kredit. Enrol memiliki pengertian yang sama dengan FREQ." },
];

export default async function TerminologyPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim().toLowerCase();

  const filtered = q
    ? TERMS.filter((t) => t.term.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q))
    : TERMS;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-800">BNI Terminology Guide</h1>
          <p className="text-slate-500 text-sm">Keterangan istilah dan singkatan yang dipakai di seluruh dashboard.</p>
        </div>

        <form method="GET" className="mb-4 flex items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-slate-200 w-fit">
          <label htmlFor="q" className="text-sm text-slate-600">Cari istilah:</label>
          <input
            type="text"
            id="q"
            name="q"
            defaultValue={q}
            placeholder="Misal: SOL, Attempt, Bunga..."
            className="border border-slate-300 rounded-lg px-3 py-1.5 text-sm w-64"
          />
          <button type="submit" className="bg-slate-800 hover:bg-slate-700 text-white text-sm px-4 py-1.5 rounded-lg transition">
            Cari
          </button>
          {q && (
            <a href="/terminology" className="text-xs text-blue-600 hover:underline ml-1">
              Reset
            </a>
          )}
        </form>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-slate-800 text-white">
              <tr>
                <th className="p-3 text-left font-medium w-56">Singkatan</th>
                <th className="p-3 text-left font-medium">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <tr key={t.term} className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                  <td className="p-3 align-top font-semibold text-slate-800">{t.term}</td>
                  <td className="p-3 align-top text-slate-600 leading-relaxed">{t.desc}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={2} className="p-4 text-center text-slate-400">
                    Tidak ada istilah yang cocok dengan pencarian.
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