"use client";

import { useState } from "react";

function formatId(digits: string) {
  if (!digits) return "";
  return new Intl.NumberFormat("id-ID").format(Number(digits));
}

export default function AsnInput({ name, defaultValue }: { name: string; defaultValue: number }) {
  const [raw, setRaw] = useState(String(Math.round(defaultValue)));

  return (
    <>
      <div className="flex items-center border border-slate-300 rounded bg-white">
        <span className="pl-2 text-sm text-slate-500">Rp</span>
        <input
          type="text"
          inputMode="numeric"
          value={formatId(raw)}
          onChange={(e) => setRaw(e.target.value.replace(/\D/g, ""))}
          className="px-2 py-1 text-right w-40 tabular-nums outline-none bg-transparent"
        />
      </div>
      <input type="hidden" name={name} value={raw || "0"} />
    </>
  );
}