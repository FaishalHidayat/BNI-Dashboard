"use client";
 
export default function PrintButton({ label = "Print PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm px-4 py-1.5 rounded-lg transition"
    >
      {label}
    </button>
  );
}