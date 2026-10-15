"use client";
 
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dispatch, JSX, SetStateAction } from "react";
 
type NavItem = {
  group: string;
  label: string;
  href: string;
  icon: JSX.Element;
};
 
const NAV_ITEMS: NavItem[] = [
  { group: "Performance", label: "ITK x ASN", href: "/itkxasn", icon: <IconUsers /> },
  { group: "Performance", label: "Monthly BNI", href: "/monthlybni", icon: <IconActivity /> },
  { group: "Performance", label: "Performance", href: "/prfm", icon: <IconTrend /> },
  { group: "Performance", label: "Yearly ITK x ASN", href: "/yearlyitkxasn", icon: <IconTrendUp /> },
  { group: "Performance", label: "MTD ITK x ASN", href: "/mtditkxasn", icon: <IconLineAxes /> },
  { group: "Ringkasan", label: "Resume Agent", href: "/resume", icon: <IconFileText /> },
  { group: "Ringkasan", label: "Daily BNI", href: "/dailybni", icon: <IconCalendar /> },
  { group: "Ringkasan", label: "Agent", href: "/", icon: <IconHome /> },
  { group: "Ringkasan", label: "Supervisor", href: "/spv", icon: <IconGrid /> },
  { group: "Ringkasan", label: "Call Duration", href: "/cd", icon: <IconBarChart /> },
  { group: "Data", label: "Kelola Agent&SPV", href: "/agents", icon: <IconUserGear /> },
  { group: "Data", label: "Upload Data", href: "/upload", icon: <IconUpload /> },
  { group: "Data", label: "Kelola & Hapus Data", href: "/manage-data", icon: <IconTrash /> },
  { group: "Data", label: "Terminology Guide", href: "/termin", icon: <IconBook /> }
];
 
const GROUPS = ["Performance", "Ringkasan", "Data"];
 
type SidebarProps = {
  collapsed: boolean;
  setCollapsed: Dispatch<SetStateAction<boolean>>;
  mobileOpen: boolean;
  setMobileOpen: Dispatch<SetStateAction<boolean>>;
};
 
export default function Sidebar({
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
}: SidebarProps) {
  const pathname = usePathname();
 
  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col
        bg-gradient-to-b from-[#14232C] to-[#192E39]
        transition-all duration-300 ease-in-out
        ${collapsed ? "md:w-[76px]" : "md:w-64"}
        w-64
        ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-[22px]">
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className="flex min-w-0 items-center gap-2.5"
        >
          <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-[9px] bg-[#2FA88F] font-extrabold text-[15px] text-[#0E1A20]">
            BNI
          </div>
          <span
            className={`truncate font-bold text-white transition-opacity duration-150 ${
              collapsed ? "md:opacity-0 md:w-0" : "opacity-100"
            }`}
          >
            Dashboard BNI
          </span>
        </Link>
 
        {/* Collapse toggle — desktop only */}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label="Persempit/lebarkan sidebar"
          className="hidden h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] text-[#9FB1BC] transition hover:bg-white/10 hover:text-white md:flex"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-4 w-4 transition-transform duration-300 ${collapsed ? "rotate-180" : ""}`}
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
 
        {/* Close — mobile only */}
        <button
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu"
          className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[7px] text-[#9FB1BC] hover:bg-white/10 hover:text-white md:hidden"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
 
      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3.5">
        {GROUPS.map((group) => (
          <div key={group}>
            <div
              className={`px-3 pb-1.5 pt-2.5 text-[11px] font-semibold tracking-wide text-white/40 ${
                collapsed ? "md:hidden" : ""
              }`}
            >
              {group}
            </div>
            {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
              const active =
                pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  onClick={() => setMobileOpen(false)}
                  className={`relative mb-0.5 flex items-center gap-3 rounded-[9px] px-3 py-2.5 text-sm font-medium transition
                    ${collapsed ? "md:justify-center md:px-0" : ""}
                    ${
                      active
                        ? "bg-[#2FA88F]/15 text-white"
                        : "text-[#9FB1BC] hover:bg-white/[0.06] hover:text-white"
                    }`}
                >
                  {active && (
                    <span className="absolute -left-3 top-2 bottom-2 w-[3px] rounded-r-[3px] bg-[#2FA88F]" />
                  )}
                  <span className="h-[18px] w-[18px] shrink-0">{item.icon}</span>
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
 
      <div
        className={`border-t border-white/10 px-5 py-3.5 text-[11.5px] text-white/50 ${
          collapsed ? "md:hidden" : ""
        }`}
      >
        BPO Ivosight 2026
      </div>
    </aside>
  );
}
 
/* ---------- Icons ---------- */
function IconHome() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" />
      <rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" />
    </svg>
  );
}
function IconBarChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M3 3v18h18" /><path d="M18 17V9" /><path d="M13 17V5" /><path d="M8 17v-3" />
    </svg>
  );
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
function IconTrend() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    </svg>
  );
}
function IconFileText() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconUserGear() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" />
      <path d="M20 8v6M23 11h-6" />
    </svg>
  );
}
function IconUpload() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}
function IconTrash() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}
function IconBook() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  );
}
function IconActivity() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  );
}
function IconTrendUp() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}
function IconLineAxes() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-full w-full">
      <polyline points="3 3 3 21 21 21" />
      <polyline points="7 15 11 11 14 14 20 7" />
    </svg>
  );
}