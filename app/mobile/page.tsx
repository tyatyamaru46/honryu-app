"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";
import type { PublicStatus } from "@/lib/syncPublicStatus";

export default function MobilePage() {
  const [status, setStatus] = useState<PublicStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const ref = doc(db, "public_status", "latest");
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setStatus(snap.data() as PublicStatus);
        }
        setLoading(false);
      },
      (err) => {
        console.error("public_status read error:", err);
        setLoading(false);
      }
    );
    return unsub;
  }, []);

  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)" }}>
        読み込み中…
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <p className="text-muted text-sm">データがまだありません。</p>
        <p className="text-dim text-xs mt-2">PCで操作するとここに表示されます。</p>
      </div>
    );
  }

  const updatedAt = status.updated_at?.toDate
    ? status.updated_at.toDate().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })
    : "";

  return (
    <div className="fade-in pb-10" style={{ maxWidth: 480, margin: "0 auto", padding: "1rem" }}>

      {/* 再開メモ */}
      {status.saikai_memo && (
        <div className="saikai-banner mt-2 mb-5">
          <div className="saikai-banner-label">▶ 再開メモ</div>
          <div className="saikai-banner-text">{status.saikai_memo}</div>
        </div>
      )}

      {/* 今日の本流 */}
      <div className="card mb-5" style={{ borderColor: "var(--accent)" }}>
        <div className="text-xs font-bold mb-1" style={{ color: "var(--accent)" }}>👑 今日の本流</div>
        <div className="text-lg font-bold">
          {status.today_focus_name ?? <span className="text-dim">未設定</span>}
        </div>
        {status.today_focus_next_action && (
          <div className="text-sm mt-2" style={{ color: "var(--green)" }}>▶ {status.today_focus_next_action}</div>
        )}
      </div>

      {/* 再確認アラート */}
      {status.pending_reviews_count > 0 && (
        <div className="card-sm mb-5 flex items-center gap-3" style={{ borderColor: "var(--red)" }}>
          <span className="badge badge-red">{status.pending_reviews_count}</span>
          <span className="text-sm">再確認が期限切れです。PCで対応してください。</span>
        </div>
      )}

      {/* 3メイン状態 */}
      <div className="text-sm font-bold mb-2" style={{ color: "var(--text-muted)" }}>📊 3メインの状況</div>
      <div className="flex-col gap-3">
        {status.mains.map((m) => {
          const isFocus = m.name === status.today_focus_name;
          return (
            <div
              key={m.id}
              className="card-sm flex justify-between items-center"
              style={{ padding: "0.75rem", borderColor: isFocus ? "var(--accent)" : undefined }}
            >
              <div>
                <div className="font-bold text-sm">
                  {isFocus && <span className="badge badge-accent" style={{ marginRight: 6 }}>本流</span>}
                  {m.name}
                </div>
                {m.next_action && (
                  <div className="text-xs mt-1" style={{ color: "var(--green)" }}>▶ {m.next_action}</div>
                )}
              </div>
              <div className="flex gap-3 text-xs text-muted">
                <span>サブ <b style={{ color: "var(--text)" }}>{m.active_subs}</b></span>
                <span>ノイズ <b style={{ color: "var(--text)" }}>{m.noises}</b></span>
              </div>
            </div>
          );
        })}
      </div>

      {updatedAt && (
        <div className="mt-6 text-center text-xs text-dim">
          最終更新: {updatedAt}
        </div>
      )}
      <div className="mt-3 text-center text-xs text-dim">
        入力・編集・レビューはPCで行ってください。
      </div>
    </div>
  );
}
