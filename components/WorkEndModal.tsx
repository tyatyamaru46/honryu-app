"use client";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { addWorkLog } from "@/lib/firestore";
import { syncPublicStatus } from "@/lib/syncPublicStatus";

interface Props { onClose: () => void; }

export default function WorkEndModal({ onClose }: Props) {
  const { user, refreshProfile } = useAuth();
  const [did, setDid] = useState("");
  const [next, setNext] = useState("");
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!user) return;
    if (!did.trim() || !next.trim() || !memo.trim()) {
      setError("3項目すべて入力してください");
      return;
    }
    setSaving(true);
    try {
      await addWorkLog(user.uid, { did_today: did, next_action: next, saikai_memo: memo });
      syncPublicStatus(user.uid); // 非同期・サイレント
      await refreshProfile();
      onClose();
    } catch {
      setError("保存に失敗しました");
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal fade-in">
        <div className="modal-title">🏁 作業終了の記録（2分）</div>
        <div className="flex-col gap-4">
          <div className="form-group">
            <label className="form-label">今日やったこと</label>
            <textarea
              className="form-textarea"
              value={did}
              onChange={(e) => setDid(e.target.value)}
              placeholder="例：DaVinciでカラーグレーディングを試した"
              rows={2}
            />
          </div>
          <div className="form-group">
            <label className="form-label">次の一手</label>
            <input
              className="form-input"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="例：次はテロップ演出を再現する"
            />
          </div>
          <div className="form-group">
            <label className="form-label">再開メモ（次回の最初の行動）</label>
            <input
              className="form-input"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="例：次はDaVinciでテロップ演出だけ再現する"
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <div className="flex gap-3 mt-4">
            <button className="btn btn-secondary w-full" onClick={onClose}>キャンセル</button>
            <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving}>
              {saving ? "保存中…" : "保存する"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
