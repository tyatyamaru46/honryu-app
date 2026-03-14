"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getNoises, addNoticedHistory, updateNoise } from "@/lib/firestore";
import type { Noise } from "@/lib/types";
import { RELATED_MAIN_NAMES } from "@/lib/types";
import { formatTokyoDateTime, isSameTokyoDay, diffHours } from "@/lib/dateUtils";

export default function NoiseDetailPage() {
  const { id: nid } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [noise, setNoise] = useState<Noise | null>(null);
  const [addingNotice, setAddingNotice] = useState(false);

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, nid]);

  const load = async () => {
    if (!user) return;
    const ns = await getNoises(user.uid);
    setNoise(ns.find((n) => n.id === nid) ?? null);
  };

  const handleNoticeAgain = async () => {
    if (!user || !noise) return;
    setAddingNotice(true);
    await addNoticedHistory(user.uid, nid);
    await load();
    setAddingNotice(false);
  };

  if (!noise) return <div className="text-muted">読み込み中…</div>;

  const history = noise.noticed_history ?? [];
  const isNoticeDisabledToday = history.length > 0 && isSameTokyoDay(history[history.length - 1].toDate(), new Date());
  const noticeCount = history.length;
  const has48h = history.length >= 2 && diffHours(history[0].toDate(), history[history.length - 1].toDate()) >= 48;
  const canPromote = noticeCount >= 2 && has48h && noise.related_main !== "unclassified" && profile?.weekly_review_status === "active";
  const promoteEligible = noticeCount >= 2 && has48h && noise.related_main !== "unclassified";

  return (
    <div className="fade-in" style={{ maxWidth: 600 }}>
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← 戻る</button>
        <h1 className="text-xl font-bold">{noise.title}</h1>
        <span className="badge badge-noise">{RELATED_MAIN_NAMES[noise.related_main]}</span>
      </div>

      {/* Content */}
      <div className="card mb-4 flex-col gap-4">
        {noise.content && (
          <div>
            <div className="form-label mb-2">内容</div>
            <div className="text-sm">{noise.content}</div>
          </div>
        )}
        {noise.reason_not_now && (
          <div>
            <div className="form-label mb-2">今やらない理由</div>
            <div className="text-sm text-muted">{noise.reason_not_now}</div>
          </div>
        )}
      </div>

      {/* Noticed history */}
      <div className="card mb-4">
        <div className="flex justify-between items-center mb-4">
          <div>
            <span className="font-medium">気になった回数</span>
            <span className="badge badge-noise ml-2">{noticeCount}回</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleNoticeAgain}
            disabled={addingNotice || isNoticeDisabledToday || noise.status !== "active"}
            title={isNoticeDisabledToday ? "今日はすでに記録済みです" : "また気になった"}
          >
            {isNoticeDisabledToday ? "今日は記録済み" : "＋ また気になった"}
          </button>
        </div>

        <div className="flex-col gap-2">
          {history.map((ts, i) => (
            <div key={i} className="flex items-center gap-2 text-sm">
              <span className="badge badge-muted">{i === 0 ? "初回" : `${i + 1}回目`}</span>
              <span className="text-muted">{formatTokyoDateTime(ts.toDate())}</span>
            </div>
          ))}
        </div>

        {/* Promotion eligibility */}
        <div className="divider" />
        <div className="section-title mb-3">昇格条件</div>
        <div className="flex-col gap-2">
          <ConditionRow ok={noticeCount >= 2} label={`2回以上気になった（現在: ${noticeCount}回）`} />
          <ConditionRow ok={has48h} label="48時間以上の間隔がある" />
          <ConditionRow ok={noise.related_main !== "unclassified"} label="関連メインが設定されている" />
          <ConditionRow ok={profile?.weekly_review_status === "active"} label="週次レビュー中である" />
        </div>

        {promoteEligible && profile?.weekly_review_status !== "active" && (
          <div className="mt-4 p-3 rounded text-sm" style={{ background: "var(--yellow-glow)", border: "1px solid rgba(245,200,66,0.2)", color: "var(--yellow)" }}>
            昇格条件は満たしています。週次レビュー時にサブへ昇格できます。
          </div>
        )}
      </div>

      {noise.status === "promoted" && (
        <div className="card-sm" style={{ background: "var(--green-glow)", border: "1px solid var(--green)" }}>
          <span style={{ color: "var(--green)" }}>✓ このノイズはサブに昇格済みです</span>
        </div>
      )}
    </div>
  );
}

function ConditionRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span style={{ color: ok ? "var(--green)" : "var(--text-dim)" }}>{ok ? "✓" : "○"}</span>
      <span className={ok ? "" : "text-dim"}>{label}</span>
    </div>
  );
}
