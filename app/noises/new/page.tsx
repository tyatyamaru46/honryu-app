"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { addNoise } from "@/lib/firestore";
import type { RelatedMain } from "@/lib/types";
import { RELATED_MAIN_NAMES } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

export default function NewNoisePage() {
  const { user } = useAuth();
  const router = useRouter();
  const [form, setForm] = useState({ title: "", content: "", related_main: "unclassified" as RelatedMain, reason_not_now: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!user) return;
    if (!form.title.trim()) { setError("タイトルは必須です"); return; }
    if (!form.reason_not_now.trim()) { setError("今やらない理由は必須です（本流を守るため）"); return; }
    setSaving(true);
    try {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await addNoise(user.uid, {
        ...form,
        next_review_date: Timestamp.fromDate(nextWeek),
        promoted_to_sub_id: null,
        status: "active",
      });
      router.push("/noises");
    } catch { setError("保存に失敗しました"); setSaving(false); }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 560 }}>
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← 戻る</button>
        <h1 className="text-xl font-bold">ノイズを入れる</h1>
      </div>

      <div className="card mb-4" style={{ background: "var(--noise-glow)", border: "1px solid rgba(167,139,250,0.2)" }}>
        <p className="text-sm" style={{ color: "var(--noise-color)" }}>
          ノイズは悪ではありません。<br />ただし、<strong>今すぐサブやメインにはしません</strong>。まずここに入れるだけです。
        </p>
      </div>

      <div className="card flex-col gap-5">
        <div className="form-group">
          <label className="form-label">タイトル（気になったこと）*</label>
          <input className="form-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例：AI動画生成の新ツールが出た" autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label">内容（もう少し詳しく）</label>
          <textarea className="form-textarea" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={3} placeholder="なぜ気になったのか" />
        </div>
        <div className="form-group">
          <label className="form-label">どのメインに近いか</label>
          <select className="form-select" value={form.related_main} onChange={(e) => setForm({ ...form, related_main: e.target.value as RelatedMain })}>
            {(Object.entries(RELATED_MAIN_NAMES) as [RelatedMain, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">今すぐやらない理由 *</label>
          <textarea className="form-textarea" value={form.reason_not_now} onChange={(e) => setForm({ ...form, reason_not_now: e.target.value })} rows={2} placeholder="例：今の本流に直接関係しない / 今週の勝ち筋に関係ない" />
          <span className="form-hint">これを書くことで本流から逸れない</span>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="flex gap-3">
          <button className="btn btn-secondary w-full" onClick={() => router.back()}>キャンセル</button>
          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
            {saving ? "保存中…" : "ノイズに入れる"}
          </button>
        </div>
      </div>
    </div>
  );
}
