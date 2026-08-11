import React, { useState } from "react";
import { Outlet, Link, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingBag, Users, Package as PackageIcon, Store, ClipboardList, LifeBuoy, Settings as SettingsIcon, LogOut, Menu, X, Receipt, MessageCircle, Bell } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { useAuth } from "@/lib/AuthContext";

const nav = [
  { to: "/", label: "Analytics", icon: LayoutDashboard },
  { to: "/orders", label: "Orders", icon: ShoppingBag },
  { to: "/transactions", label: "Transactions", icon: Receipt },
  { to: "/agents", label: "Agents", icon: Users },
  { to: "/packages", label: "Packages", icon: PackageIcon },
  { to: "/agent-store", label: "Stores", icon: Store },
  { to: "/bulk-status", label: "Bulk", icon: ClipboardList },
  { to: "/reports", label: "Reports", icon: LifeBuoy },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

export default function Layout() {
  const { pathname } = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  const links = (
    <nav className="flex flex-col gap-1">
      {nav.map(({ to, label, icon: Icon }) => {
        const active = pathname === to;
        return (
          <Link
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all ${
              active
                ? "bg-[#1E6FE8] text-white shadow-sm shadow-[#1E6FE8]/40 ring-1 ring-inset ring-white/10"
                : "text-slate-300/90 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
            {label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col justify-between bg-[#0B1E3F] px-5 py-8 text-white">
        <div>
          <Link to="/" className="flex items-center gap-3 px-1 mb-10 rounded-xl hover:bg-white/5 transition-colors">
            <img src="https://media.base44.com/images/public/6a7662b431db147eef96232e/d24c6ad57_generated_image.png" alt="GrandCoders" className="w-9 h-9 rounded-lg object-cover ring-1 ring-white/10" />
            <div>
              <p className="text-lg font-semibold tracking-tight leading-none">GrandCoders</p>
              <p className="text-[11px] text-slate-400 mt-1 tracking-wide uppercase">Bundle ops</p>
            </div>
          </Link>
          <div className="mx-1 mb-6 h-px bg-gradient-to-r from-[#1E6FE8]/60 via-[#F5B700]/40 to-transparent" />
          {links}
        </div>
        <button
          onClick={() => logout()}
          className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sign out
        </button>
      </aside>

      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-[#0B1E3F] px-5 py-3.5 text-white">
        <Link to="/" className="flex items-center gap-2">
          <img src="https://media.base44.com/images/public/6a7662b431db147eef96232e/d24c6ad57_generated_image.png" alt="GrandCoders" className="w-7 h-7 rounded-lg object-cover" />
          <p className="font-semibold tracking-tight">GrandCoders</p>
        </Link>
        <div className="flex items-center gap-1">
          <button
            onClick={() => logout()}
            aria-label="Sign out"
            className="inline-flex items-center justify-center w-11 h-11 rounded-lg hover:bg-white/10 active:bg-white/20 active:scale-95 transition-all touch-manipulation text-slate-300"
          >
            <LogOut className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            className="inline-flex items-center justify-center w-11 h-11 -mr-2 rounded-lg hover:bg-white/10 active:bg-white/20 active:scale-95 transition-all touch-manipulation"
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
        {open && (
          <div className="absolute left-0 right-0 top-full border-b border-white/10 bg-[#0B1E3F] px-4 py-3 shadow-xl max-h-[75vh] overflow-y-auto">
            {links}
            <button
              onClick={() => logout()}
              className="mt-2 flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
            >
              <LogOut className="w-4 h-4" strokeWidth={1.75} /> Sign out
            </button>
          </div>
        )}
      </header>

      <main className="md:pl-64">
        <div className="flex justify-end px-5 pt-5 md:px-10">
          <ThemeToggle />
        </div>
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-4 md:px-10 md:pb-16">
          <Outlet />
        </div>
      </main>
    </div>
  );
}