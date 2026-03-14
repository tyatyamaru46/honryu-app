"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import WorkEndModal from "./WorkEndModal";

export default function NavBar() {
  const { user, profile, signOutUser } = useAuth();
  const pathname = usePathname();
  const [showWorkEnd, setShowWorkEnd] = useState(false);

  if (!user) return null;

  const links = [
    { href: "/", label: "ホーム" },
    { href: "/mobile", label: "📱 簡易入力" },
    { href: "/noises", label: "ノイズ" },
    { href: "/reviews", label: "再確認" },
    { href: "/weekly-review", label: "週次レビュー" },
    { href: "/settings", label: "設定" },
  ];

  return (
    <>
      <nav className="nav">
        <div className="nav-logo">
          本流<span>守護</span>
        </div>
        <div className="nav-links">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={`nav-link ${pathname === l.href ? "active" : ""}`}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav-right">
          {profile?.weekly_review_status === "active" && (
            <span className="badge badge-yellow">レビュー中</span>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => setShowWorkEnd(true)}>
            作業終了
          </button>
          <button className="btn btn-ghost btn-sm" onClick={signOutUser}>
            ログアウト
          </button>
        </div>
      </nav>
      {showWorkEnd && <WorkEndModal onClose={() => setShowWorkEnd(false)} />}
    </>
  );
}
