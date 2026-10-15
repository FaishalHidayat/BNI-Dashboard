"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "spv_hide_cek_columns";

function applyVisibility(hidden: boolean) {
  document.querySelectorAll<HTMLElement>(".col-cek").forEach((el) => {
    el.style.display = hidden ? "none" : "";
  });
}

export default function HideCekToggle() {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) === "1";
    setHidden(stored);
    applyVisibility(stored);
  }, []);

  function toggle() {
    const next = !hidden;
    setHidden(next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    applyVisibility(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm px-4 py-1.5 rounded-lg transition"
    >
      {hidden ? "Tampilkan kolom Cek" : "Sembunyikan kolom Cek"}
    </button>
  );
}