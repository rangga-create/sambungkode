"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useAuth } from "./AuthProvider";

interface TopbarProps {
  sessionCode?: string;
  hud?: ReactNode;
}

export function Topbar({ sessionCode, hud }: TopbarProps) {
  const { profile } = useAuth();
  const pathname = usePathname();
  const isAdmin = profile?.role === "ADMIN";
  const adminActive = pathname.startsWith("/admin");

  return (
    <header className="topbar">
      <div className="brand-group">
        <Image
          src="/sambungkode-logo.webp"
          alt="SambungKode"
          width={532}
          height={83}
          className="brand-logo"
        />
        <span className="session-pill">SESI: {sessionCode ?? "—"}</span>
        <nav className="mode-switch">
          <Link href="/" className={`mode-btn${adminActive ? "" : " active"}`}>
            Mode Peserta
          </Link>
          {isAdmin && (
            <Link href="/admin" className={`mode-btn${adminActive ? " active" : ""}`}>
              Panel Panitia
            </Link>
          )}
        </nav>
      </div>
      <div className="hud-group">{hud}</div>
    </header>
  );
}
