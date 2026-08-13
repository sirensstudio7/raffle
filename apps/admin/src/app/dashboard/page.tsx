"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { SpinDashboardClient } from "@/components/spin-dashboard-client";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

export default function DashboardPage() {
  const { token, user, logout, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !token) router.replace("/login");
  }, [ready, token, router]);

  if (!ready || !token) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 lg:px-6">
          <div>
            <p className="text-sm font-semibold text-slate-900">Raffle Admin</p>
            <p className="text-xs text-slate-500">{user?.email}</p>
          </div>
          <div className="flex items-center gap-3">
            <a
              href={process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:9980"}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-orange-600 hover:underline"
            >
              View public site
            </a>
            <Button variant="outline" size="sm" onClick={() => { logout(); router.push("/login"); }}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="px-4 py-8 lg:px-6">
        <SpinDashboardClient />
      </main>
    </div>
  );
}
