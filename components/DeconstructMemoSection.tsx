"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { 
  getDeconstructMemos, 
  addDeconstructMemo, 
  updateDeconstructMemo, 
  deleteDeconstructMemo 
} from "@/lib/firestore";
import type { DeconstructMemo, MemoLinkedType, MemoStatus } from "@/lib/types";
import { MEMO_STATUS_NAMES } from "@/lib/types";
import { formatTokyoDateTime } from "@/lib/dateUtils";

interface Props {
  linkedType: MemoLinkedType;
  linkedId: string | null;
}

export default function DeconstructMemoSection({ linkedType, linkedId }: Props) {
  const { user } = useAuth();
  const [memos, setMemos] = useState<DeconstructMemo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedMemo, setSelectedMemo] = useState<DeconstructMemo | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<MemoStatus>("unprocessed");

  useEffect(() => {
    if (user) load();
  }, [user, linkedType, linkedId]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await getDeconstructMemos(user.uid, linkedType, linkedId);
      setMemos(data);
    } catch (err) {
      console.error("Failed to load memos", err);
    }
    setLoading(false);
  };

  const handleOpenNew = () => {
    setSelectedMemo(null);
    setTitle("");
    setBody("");
    setStatus("unprocessed");
    setIsEditing(true);
    setShowModal(true);
  };

  const handleOpenDetail = (memo: DeconstructMemo) => {
    setSelectedMemo(memo);
    setTitle(memo.title);
    setBody(memo.body);
    setStatus(memo.status);
    setIsEditing(false);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!user || !title.trim()) return;
    setSaving(true);
    try {
      if (selectedMemo?.id) {
        await updateDeconstructMemo(user.uid, selectedMemo.id, { title, body, status });
      } else {
        await addDeconstructMemo(user.uid, {
          title,
          body,
          status,
          linkedType,
          linkedId,
        });
      }
      setShowModal(false);
      await load();
    } catch (err) {
      console.error("Failed to save memo", err);
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!user || !selectedMemo?.id || !confirm("削除しますか？")) return;
    setSaving(true);
    try {
      await deleteDeconstructMemo(user.uid, selectedMemo.id);
      setShowModal(false);
      await load();
    } catch (err) {
      console.error("Failed to delete memo", err);
    }
    setSaving(false);
  };

  const getStatusBadgeClass = (s: MemoStatus) => {
    switch (s) {
      case "adopted": return "badge-green";
      case "hold": return "badge-yellow";
      case "discarded": return "badge-red";
      default: return "badge-muted";
    }
  };

  return (
    <div className="mt-12">
      <div className="section-header mb-4">
        <div className="section-title">分解メモ（思考の置き場）</div>
        <button className="btn btn-secondary btn-sm" onClick={handleOpenNew}>
          ＋ メモを追加
        </button>
      </div>

      <div className="flex-col gap-2">
        {loading ? (
          <div className="text-sm text-dim">読み込み中...</div>
        ) : memos.length === 0 ? (
          <div className="card-sm text-center py-8 text-dim text-sm" style={{ borderStyle: 'dashed' }}>
            メモはありません。AI相談の案や下書きを保存しましょう。
          </div>
        ) : (
          memos.map((m) => (
            <div 
              key={m.id} 
              className="card-sm card-hover flex items-center justify-between" 
              onClick={() => handleOpenDetail(m)}
            >
              <div className="flex items-center gap-3">
                <span className={`badge ${getStatusBadgeClass(m.status)}`}>
                  {MEMO_STATUS_NAMES[m.status]}
                </span>
                <span className="font-medium text-sm">{m.title}</span>
              </div>
              <div className="text-xs text-dim">
                {m.updated_at ? formatTokyoDateTime(m.updated_at.toDate()) : ""}
              </div>
            </div>
          ))
        )}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal fade-in" style={{ maxWidth: 700 }}>
            <div className="flex items-center justify-between mb-6">
              <div className="modal-title mb-0">
                {selectedMemo ? (isEditing ? "メモを編集" : "メモ詳細") : "新しい分解メモ"}
              </div>
              <div className="flex gap-2">
                {!isEditing && selectedMemo && (
                  <>
                    <button className="btn btn-ghost btn-sm" onClick={() => setIsEditing(true)}>✏️ 編集</button>
                    <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={saving}>削除</button>
                  </>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>✕ 閉じる</button>
              </div>
            </div>

            <div className="flex-col gap-4">
              <div className="form-group">
                <label className="form-label">題名</label>
                {isEditing ? (
                  <input 
                    className="form-input" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="例: AI相談後のタスク案"
                  />
                ) : (
                  <div className="text-lg font-bold">{title}</div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">本文</label>
                {isEditing ? (
                  <textarea 
                    className="form-textarea" 
                    value={body} 
                    onChange={(e) => setBody(e.target.value)} 
                    rows={12}
                    placeholder="AIの回答や、チェックリストにしたい内容を自由に。長文も可。"
                  />
                ) : (
                  <div className="card-sm bg-bg whitespace-pre-wrap text-sm leading-relaxed" style={{ minHeight: 200 }}>
                    {body || <span className="text-dim">本文なし</span>}
                  </div>
                )}
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">状態</label>
                  {isEditing ? (
                    <select 
                      className="form-select" 
                      value={status} 
                      onChange={(e) => setStatus(e.target.value as MemoStatus)}
                    >
                      {Object.entries(MEMO_STATUS_NAMES).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  ) : (
                    <div>
                      <span className={`badge ${getStatusBadgeClass(status)}`}>
                        {MEMO_STATUS_NAMES[status]}
                      </span>
                    </div>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label">作成 / 更新</label>
                  <div className="text-xs text-dim">
                    作: {selectedMemo?.created_at ? formatTokyoDateTime(selectedMemo.created_at.toDate()) : "新規"}<br/>
                    更: {selectedMemo?.updated_at ? formatTokyoDateTime(selectedMemo.updated_at.toDate()) : "新規"}
                  </div>
                </div>
              </div>

              {isEditing && (
                <button className="btn btn-primary w-full mt-4" onClick={handleSave} disabled={saving || !title.trim()}>
                  {saving ? "保存中..." : (selectedMemo ? "変更を保存する" : "新規作成して保存")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
