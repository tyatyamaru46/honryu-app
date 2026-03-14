"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import {
  getMains,
  getSubs,
  getNoises,
  getWeeklyReview,
  updateWeeklyReview,
  completeWeeklyReview,
  promoteNoiseToSub,
  startWeeklyReview,
} from "@/lib/firestore";
import type { Main, Sub, Noise, WeeklyReview } from "@/lib/types";

export default function WeeklyReviewPage() {
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [mains, setMains] = useState<Main[]>([]);
  const [noises, setNoises] = useState<Noise[]>([]);
  const [review, setReview] = useState<WeeklyReview | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Step 2: Promotion state
  const [selectedNoise, setSelectedNoise] = useState<Noise | null>(null);
  const [promoForm, setPromoForm] = useState({ name: "", purpose: "", deliverable: "", reason_to_do_now: "", next_action: "", is_active: false });
  const [promoError, setPromoError] = useState("");

  useEffect(() => {
    if (user && profile) load();
  }, [user, profile]);

  const load = async () => {
    if (!user || !profile) return;
    try {
      if (profile.weekly_review_status === "idle") {
        const id = await startWeeklyReview(user.uid);
        await refreshProfile();
        const r = await getWeeklyReview(user.uid, id);
        setReview(r);
      } else if (profile.current_weekly_review_id) {
        const r = await getWeeklyReview(user.uid, profile.current_weekly_review_id);
        setReview(r);
      }
      const [ms, ns] = await Promise.all([getMains(user.uid), getNoises(user.uid)]);
      setMains(ms);
      setNoises(ns.filter((n) => n.status === "active"));
    } catch (e) { console.error(e); }
  };

  const handleStep1Save = async () => {
    if (!user || !review) return;
    setSaving(true);
    await updateWeeklyReview(user.uid, review.id!, {
      main_progress: review.main_progress,
      next_win_this_week: review.next_win_this_week,
    });
    setSaving(false);
    setStep(2);
  };

  const handlePromote = async () => {
    if (!user || !review || !selectedNoise) return;
    if (!promoForm.deliverable.trim() || !promoForm.next_action.trim()) {
      setPromoError("成果物と次の一手は必須です");
      return;
    }
    setSaving(true);
    try {
      await promoteNoiseToSub(user.uid, selectedNoise.id!, selectedNoise.related_main as any, {
        ...promoForm,
        understanding_level: "見た",
        skill_bucket: selectedNoise.related_main === "skill_building" ? "future" : null,
      } as any);
      const newPromos = [...(review.promotions ?? []), selectedNoise.id!];
      await updateWeeklyReview(user.uid, review.id!, { promotions: newPromos });
      setSelectedNoise(null);
      setPromoForm({ name: "", purpose: "", deliverable: "", reason_to_do_now: "", next_action: "", is_active: false });
      await load();
    } catch (e: any) { setPromoError(e.message); }
    setSaving(false);
  };

  const handleComplete = async () => {
    if (!user || !review) return;
    setSaving(true);
    try {
      await completeWeeklyReview(user.uid, review.id!, {});
      await refreshProfile();
      router.push("/");
    } catch { setSaving(false); setError("完了処理に失敗しました"); }
  };

  if (!profile || !review) return <div className="text-muted">読み込み中…</div>;

  const promoCandidates = noises.filter((n) => {
    const noticeCount = n.noticed_history?.length ?? 0;
    const has48h = noticeCount >= 2 && n.noticed_history && n.noticed_history[n.noticed_history.length - 1].toMillis() - n.noticed_history[0].toMillis() >= 48 * 60 * 60 * 1000;
    return noticeCount >= 2 && has48h && n.related_main !== "unclassified";
  });

  return (
    <div className="fade-in" style={{ maxWidth: 800 }}>
      <div className="flex items-center gap-4 mb-6">
        <h1 className="text-xl font-bold">週次レビュー</h1>
        <span className="badge badge-yellow">進行中</span>
      </div>

      <div className="steps mb-6">
        {[1,2,3].map((n) => (
          <div key={n} className="flex items-center" style={{ flex: n < 3 ? 1 : 0 }}>
            <div className={`step-dot ${step === n ? "active" : step > n ? "done" : ""}`}>{step > n ? "✓" : n}</div>
            {n < 3 && <div className="step-line" />}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="flex-col gap-6 fade-in">
          <div className="section-title">Step 1: 今週の振り返りと次週の勝ち筋</div>
          {mains.map((m) => (
            <div key={m.id} className="card-sm flex-col gap-3">
              <div className="font-bold text-lg">{m.name}</div>
              <div className="form-group">
                <label className="form-label">今週はどうだったか</label>
                <textarea
                  className="form-textarea"
                  value={review.main_progress[m.id] ?? ""}
                  onChange={(e) => setReview({ ...review, main_progress: { ...review.main_progress, [m.id]: e.target.value } })}
                  rows={2}
                />
              </div>
              <div className="form-group">
                <label className="form-label">次週の勝ち筋（1行）</label>
                <input
                  className="form-input"
                  value={review.next_win_this_week[m.id] ?? m.win_this_week ?? ""}
                  onChange={(e) => setReview({ ...review, next_win_this_week: { ...review.next_win_this_week, [m.id]: e.target.value } })}
                />
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={handleStep1Save} disabled={saving}>
            {saving ? "保存中…" : "次へ: ノイズの昇格 →"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="flex-col gap-6 fade-in">
          <div className="section-title">Step 2: ノイズの昇格（サブへ）</div>
          <p className="text-sm text-dim mb-4">
            昇格条件（48時間以上、2回以上気になった）を満たしたノイズだけが表示されます。<br />
            本当に今サブにするべきか見極めてください。
          </p>

          {!selectedNoise ? (
            <div className="grid-2">
              {promoCandidates.map((n) => (
                <div key={n.id} className="noise-card card-hover flex-col gap-2" onClick={() => {
                  setSelectedNoise(n);
                  setPromoForm({
                    name: n.title,
                    purpose: n.content ?? "",
                    deliverable: "",
                    reason_to_do_now: n.reason_not_now ?? "",
                    next_action: "",
                    is_active: false,
                  });
                }}>
                  <div className="font-medium">{n.title}</div>
                  <div className="text-sm text-muted">{n.content}</div>
                  <div className="mt-2">
                    <span className="badge badge-yellow">昇格候補</span>
                  </div>
                </div>
              ))}
              {promoCandidates.length === 0 && (
                <div className="empty-state w-full" style={{ gridColumn: "1 / -1" }}>
                  <div className="empty-state-text">昇格できるノイズはありません</div>
                </div>
              )}
            </div>
          ) : (
            <div className="card" style={{ borderColor: "var(--yellow)" }}>
              <div className="flex justify-between items-center mb-4">
                <div className="font-bold text-lg">サブとして登録</div>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedNoise(null)}>やめる</button>
              </div>
              <div className="flex-col gap-4">
                <div className="form-group"><label className="form-label">名前 *</label><input className="form-input" value={promoForm.name} onChange={(e) => setPromoForm({ ...promoForm, name: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">目的 *</label><textarea className="form-textarea" value={promoForm.purpose} onChange={(e) => setPromoForm({ ...promoForm, purpose: e.target.value })} rows={2} /></div>
                <div className="form-group"><label className="form-label">成果物 *</label><input className="form-input" value={promoForm.deliverable} onChange={(e) => setPromoForm({ ...promoForm, deliverable: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">今やる理由</label><input className="form-input" value={promoForm.reason_to_do_now} onChange={(e) => setPromoForm({ ...promoForm, reason_to_do_now: e.target.value })} /></div>
                <div className="form-group"><label className="form-label">次の一手 *</label><input className="form-input" value={promoForm.next_action} onChange={(e) => setPromoForm({ ...promoForm, next_action: e.target.value })} /></div>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={promoForm.is_active} onChange={(e) => setPromoForm({ ...promoForm, is_active: e.target.checked })} /> アクティブにする（メインごとに最大2件）
                </label>
                {promoError && <p className="form-error">{promoError}</p>}
                <button className="btn btn-primary w-full" onClick={handlePromote} disabled={saving}>{saving ? "保存中…" : "サブに昇格する"}</button>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-4">
            <button className="btn btn-ghost" onClick={() => setStep(1)}>← 戻る</button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>次へ: 完了 →</button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex-col gap-6 fade-in text-center py-8">
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="text-xl font-bold mb-2">週次レビュー完了</h2>
          <p className="text-sm text-dim mb-6">今週の勝ち筋が設定され、ノイズが整理されました。<br />本流に戻りましょう。</p>
          {error && <p className="form-error mb-4">{error}</p>}
          <div className="flex justify-center gap-4">
            <button className="btn btn-ghost" onClick={() => setStep(2)}>← 戻る</button>
            <button className="btn btn-primary btn-lg" onClick={handleComplete} disabled={saving}>{saving ? "完了処理中…" : "レビューを終了する"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
