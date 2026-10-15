"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "agents_hide_unassigned_warning";

function applyVisibility(hidden: boolean) {
  document.querySelectorAll<HTMLElement>(".unassigned-warning").forEach((el) => {
    el.style.display = hidden ? "none" : "";
  });
}

export default function HideUnassignedToggle() {
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
      className="bg-white border border-amber-300 hover:bg-amber-50 text-amber-800 text-xs px-3 py-1 rounded-lg transition"
    >
      {hidden ? "Tampilkan keterangan" : "Sembunyikan keterangan"}
    </button>
  );
}