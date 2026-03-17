"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getPendingReviews, completeReview } from "@/lib/firestore";
import { syncPublicStatus } from "@/lib/syncPublicStatus";
import type { Review } from "@/lib/types";
import { formatTokyoDateTime } from "@/lib/dateUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ReviewsPage() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [activeReview, setActiveReview] = useState<Review | null>(null);
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    try {
      const rs = await getPendingReviews(user.uid);
      setReviews(rs.sort((a, b) => (a.scheduled_date?.toMillis() || 0) - (b.scheduled_date?.toMillis() || 0)));
    } catch (err) {
      console.error("Failed to load reviews:", err);
    }
  };

  const handleComplete = async () => {
    if (!user || !activeReview || !activeReview.main_id || !activeReview.sub_id || !activeReview.id) return;
    if (!answer.trim()) return;
    setSaving(true);
    try {
      await completeReview(user.uid, activeReview.main_id, activeReview.sub_id, activeReview.id, answer);
      syncPublicStatus(user.uid); // 非同期・サイレント
      setActiveReview(null);
      setAnswer("");
      await load();
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const overdueCount = reviews.filter((r) => r.scheduled_date && r.scheduled_date.toDate() <= new Date()).length;

  return (
    <div className="fade-in">
      <div className="section-header mb-6">
        <div>
          <h1 className="text-xl font-bold">再確認（AI相談の復習）</h1>
          <p className="text-sm text-dim mt-1">
            忘却曲線に合わせて自動で問題が出ます。<br />
            答えられなかったら理解段階を下げ、またAIに相談しましょう。
          </p>
        </div>
      </div>

      <div className="flex gap-4 mb-6">
        <div className="card-sm">未回答: <strong>{reviews.length}件</strong></div>
        {overdueCount > 0 && <div className="card-sm" style={{ color: "var(--red)" }}>期限切れ: <strong>{overdueCount}件</strong></div>}
      </div>

      {activeReview ? (
        <div className="card mb-6 flex-col gap-4" style={{ borderColor: "var(--accent)" }}>
          <div className="flex justify-between">
            <span className="badge badge-accent">{activeReview.question_type}</span>
            <span className="text-sm text-dim">
              出題日: {activeReview.scheduled_date ? formatTokyoDateTime(activeReview.scheduled_date.toDate()) : ""}
            </span>
          </div>
          <div>
            <div className="font-medium text-lg mb-2">
              {activeReview.question_type === "3行説明" && "学習した内容を自分の言葉で3行で説明してください。"}
              {activeReview.question_type === "最初の一手" && "手順を再現するための「最初の一手」は何ですか？"}
              {activeReview.question_type === "なぜその方法か" && "なぜその方法を選んだのか理由を説明してください。"}
            </div>
            <p className="text-sm text-muted">※頭の中で思い浮かべるだけでも可。記録として残すとより良いです。</p>
          </div>
          <textarea
            className="form-textarea"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="回答を入力..."
            rows={3}
            autoFocus
          />
          <div className="flex gap-3">
            <button className="btn btn-secondary w-full" onClick={() => setActiveReview(null)}>あとにする</button>
            <button className="btn btn-primary w-full" onClick={handleComplete} disabled={saving || !answer.trim()}>
              {saving ? "保存中…" : "完了する"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-col gap-3">
          {reviews.map((r) => {
            const isOverdue = r.scheduled_date && r.scheduled_date.toDate() <= new Date();
            return (
              <div key={r.id} className="card-sm card-hover flex justify-between items-center" onClick={() => setActiveReview(r)}>
                <div className="flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className={`badge ${isOverdue ? "badge-red" : "badge-accent"}`}>
                      {r.question_type}
                    </span>
                    {isOverdue && <span className="text-sm" style={{ color: "var(--red)" }}>⚠ 期限切れ</span>}
                  </div>
                  <div className="text-sm text-muted mt-1">
                    {r.scheduled_date ? formatTokyoDateTime(r.scheduled_date.toDate()) : ""}
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm">回答する →</button>
              </div>
            );
          })}
          {reviews.length === 0 && (
            <div className="empty-state">
              <div className="empty-state-icon">✅</div>
              <div className="empty-state-text">未回答の再確認はありません</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
