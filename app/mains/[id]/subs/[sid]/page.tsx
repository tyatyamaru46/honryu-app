"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getSubs, getAiLogs, getAllAiLogs, updateSub, saveAiLog } from "@/lib/firestore";
import type { Sub, AiLog, UnderstandingLevel } from "@/lib/types";
import { formatTokyoDateTime } from "@/lib/dateUtils";
import Link from "next/link";
import DeconstructMemoSection from "@/components/DeconstructMemoSection";

const LEVELS: UnderstandingLevel[] = ["見た", "意味はわかる", "手順を言える", "自力で再現できる"];

export default function SubDetailPage() {
  const { id: mainId, sid } = useParams<{ id: string; sid: string }>();
  const { user, profile } = useAuth();
  const router = useRouter();
  const [sub, setSub] = useState<Sub | null>(null);
  const [aiLogs, setAILogs] = useState<AiLog[]>([]);
  const [showAiLog, setShowAiLog] = useState(false);
  const [aiStep, setAIStep] = useState(1);
  const [similar, setSimilar] = useState<AiLog[]>([]);
  const [stepErr, setStepErr] = useState("");
  const [aiForm, setAIForm] = useState({ what_i_know: "", where_stuck: "", my_hypothesis: "", difference_from_last: "", ai_answer: "", my_summary_3lines: "", first_step_to_reproduce: "", understanding_level_after: "見た" as UnderstandingLevel });
  const [geminiResult, setGeminiResult] = useState<{ golden_prompt?: string, outcome?: string, tips?: string, user_memo?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [callingGemini, setCallingGemini] = useState(false);
  const [error, setError] = useState("");

  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", purpose: "", deliverable: "", next_action: "", reason_to_do_now: "", saikai_memo: "" });

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, mainId, sid]);

  const load = async () => {
    if (!user) return;
    const [subs, logs] = await Promise.all([getSubs(user.uid, mainId), getAiLogs(user.uid, mainId, sid)]);
    const s = subs.find((s) => s.id === sid) ?? null;
    setSub(s);
    setAILogs(logs);
    if (s) {
      setEditForm({
        name: s.name,
        purpose: s.purpose,
        deliverable: s.deliverable,
        next_action: s.next_action,
        reason_to_do_now: s.reason_to_do_now || "",
        saikai_memo: s.saikai_memo || ""
      });
    }
  };

  const handleUpdateSub = async () => {
    if (!user || !sub) return;
    setSaving(true);
    try {
      await updateSub(user.uid, mainId, sid, editForm);
      setIsEditing(false);
      await load();
    } catch {
      setError("更新に失敗しました");
    }
    setSaving(false);
  };

  const findSimilar = async (text: string) => {
    if (!user || !text.trim()) { setSimilar([]); return; }
    const all = await getAllAiLogs(user.uid);
    const words = text.split(/[\s、。，,]+/).filter(Boolean);
    const scored = all.map((log) => {
      const haystack = `${log.what_i_know} ${log.my_summary_3lines}`;
      const score = words.reduce((acc, w) => acc + (haystack.includes(w) ? 1 : 0), 0);
      return { log, score };
    });
    setSimilar(scored.sort((a, b) => b.score - a.score).filter((s) => s.score > 0).slice(0, 3).map((s) => s.log));
  };

  const handleStep1Next = () => {
    if (!aiForm.what_i_know.trim() || !aiForm.where_stuck.trim() || !aiForm.my_hypothesis.trim()) {
      setStepErr("3項目すべて入力してください");
      return;
    }
    setStepErr("");
    findSimilar(aiForm.what_i_know);
    setAIStep(2);
  };

  const handleSaveLog = async (useGemini = false) => {
    if (!user) return;
    if (!aiForm.my_summary_3lines.trim() || !aiForm.first_step_to_reproduce.trim()) {
      setStepErr("3行要約と最初の一手は必須です");
      return;
    }
    
    setStepErr("");
    let extraFields = geminiResult || {};

    if (useGemini) {
      setCallingGemini(true);
      try {
        const res = await fetch("/api/gemini", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aiForm),
        });
        const data = await res.json();
        if (!data.disabled && !data.error) {
          extraFields = {
            golden_prompt: data.golden_prompt,
            outcome: data.outcome,
            tips: data.tips,
            user_memo: data.user_memo,
          };
        }
      } catch (err) {
        console.error("Gemini API call failed", err);
        // Continue saving normally even if Gemini fails
      }
      setCallingGemini(false);
    }

    setSaving(true);
    try {
      await saveAiLog(user.uid, mainId, sid, {
        ...aiForm,
        understanding_level_after: aiForm.understanding_level_after,
        ...extraFields,
      }, profile?.review_intervals ?? [1, 3, 7]);
      await updateSub(user.uid, mainId, sid, { understanding_level: aiForm.understanding_level_after });
      setShowAiLog(false);
      setAIStep(1);
      setAIForm({ what_i_know: "", where_stuck: "", my_hypothesis: "", difference_from_last: "", ai_answer: "", my_summary_3lines: "", first_step_to_reproduce: "", understanding_level_after: "見た" });
      setGeminiResult(null);
      await load();
    } catch { setStepErr("保存に失敗しました"); }
    setSaving(false);
  };

  if (!sub) return <div className="text-muted">読み込み中…</div>;

  const levelIdx = LEVELS.indexOf(sub.understanding_level);

  return (
    <div className="fade-in">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← 戻る</button>
          {!isEditing ? (
            <h1 className="text-xl font-bold">{sub.name}</h1>
          ) : (
            <input 
              className="form-input text-xl font-bold" 
              value={editForm.name} 
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          )}
          {sub.is_active && <span className="badge badge-green">アクティブ</span>}
        </div>
        <button 
          className={`btn btn-sm ${isEditing ? "btn-secondary" : "btn-ghost"}`} 
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? "キャンセル" : "✏️ 編集"}
        </button>
      </div>

      {isEditing ? (
        <div className="card-sm flex-col gap-4 mb-8">
          <div className="form-group">
            <label className="form-label">目的</label>
            <textarea className="form-textarea" value={editForm.purpose} onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">成果物</label>
            <input className="form-input" value={editForm.deliverable} onChange={(e) => setEditForm({ ...editForm, deliverable: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">次の一手</label>
            <input className="form-input" value={editForm.next_action} onChange={(e) => setEditForm({ ...editForm, next_action: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">今すぐやる理由</label>
            <textarea className="form-textarea" value={editForm.reason_to_do_now} onChange={(e) => setEditForm({ ...editForm, reason_to_do_now: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">再開メモ</label>
            <input className="form-input" value={editForm.saikai_memo} onChange={(e) => setEditForm({ ...editForm, saikai_memo: e.target.value })} />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button className="btn btn-primary w-full" onClick={handleUpdateSub} disabled={saving}>
            {saving ? "保存中..." : "変更を保存する"}
          </button>
        </div>
      ) : (
        <div className="grid-2 mb-6">
          <div className="card-sm flex-col gap-2">
            <div className="form-label">目的</div>
            <div className="text-sm">{sub.purpose || "—"}</div>
          </div>
          <div className="card-sm flex-col gap-2">
            <div className="form-label">成果物</div>
            <div className="text-sm">{sub.deliverable || "—"}</div>
          </div>
          <div className="card-sm flex-col gap-2">
            <div className="form-label">次の一手</div>
            <div className="text-sm" style={{ color: "var(--green)" }}>▶ {sub.next_action || "—"}</div>
          </div>
          <div className="card-sm flex-col gap-2">
            <div className="form-label">理解段階</div>
            <div className="flex items-center gap-2">
              <div className="level-bars">
                {[1,2,3,4].map((n) => <div key={n} className={`level-bar ${n <= levelIdx + 1 ? `filled-${n}` : ""}`} />)}
              </div>
              <span className="text-sm">{sub.understanding_level}</span>
            </div>
          </div>
        </div>
      )}

      {sub.saikai_memo && (
        <div className="saikai-banner mb-6">
          <div className="saikai-banner-label">▶ 再開メモ</div>
          <div className="saikai-banner-text">{sub.saikai_memo}</div>
        </div>
      )}

      {/* AI consultation button */}
      <div className="section-header mb-4">
        <div className="section-title">AI相談ログ</div>
        <button className="btn btn-primary btn-sm" onClick={() => { setShowAiLog(true); setAIStep(1); }}>
          ＋ AI相談を記録
        </button>
      </div>

      {/* AI modal */}
      {showAiLog && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && setShowAiLog(false)}>
          <div className="modal fade-in" style={{ maxWidth: 600 }}>
            <div className="modal-title">AI相談を記録する</div>
            <div className="steps mb-6">
              {[1,2,3,4].map((n) => (
                <>
                  <div key={n} className={`step-dot ${aiStep === n ? "active" : aiStep > n ? "done" : ""}`}>{aiStep > n ? "✓" : n}</div>
                  {n < 4 && <div className="step-line" />}
                </>
              ))}
            </div>

            {aiStep === 1 && (
              <div className="flex-col gap-4">
                <p className="text-sm text-muted mb-2">AIに聞く前に、自分の頭を先に動かします。</p>
                <div className="form-group">
                  <label className="form-label">今わかっていること *</label>
                  <textarea className="form-textarea" value={aiForm.what_i_know} onChange={(e) => setAIForm({ ...aiForm, what_i_know: e.target.value })} rows={3} />
                </div>
                <div className="form-group">
                  <label className="form-label">どこで止まっているか *</label>
                  <textarea className="form-textarea" value={aiForm.where_stuck} onChange={(e) => setAIForm({ ...aiForm, where_stuck: e.target.value })} rows={2} />
                </div>
                <div className="form-group">
                  <label className="form-label">自分の仮説 *</label>
                  <textarea className="form-textarea" value={aiForm.my_hypothesis} onChange={(e) => setAIForm({ ...aiForm, my_hypothesis: e.target.value })} rows={2} />
                </div>
                {stepErr && <p className="form-error">{stepErr}</p>}
                <button className="btn btn-primary" onClick={handleStep1Next}>次へ →</button>
              </div>
            )}

            {aiStep === 2 && (
              <div className="flex-col gap-4">
                {similar.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-3" style={{ color: "var(--yellow)" }}>⚠️ 過去の類似質問 — まず確認してください</p>
                    {similar.map((s, i) => (
                      <div key={i} className="card-sm mb-2" style={{ borderColor: "rgba(245,200,66,0.2)" }}>
                        <div className="text-sm font-medium mb-1">{s.what_i_know.slice(0, 60)}…</div>
                        <div className="text-sm text-muted">{s.my_summary_3lines?.slice(0, 80)}…</div>
                        <div className="text-sm text-dim mt-1">{s.created_at ? formatTokyoDateTime(s.created_at.toDate()) : ""}</div>
                      </div>
                    ))}
                    <div className="form-group mt-3">
                      <label className="form-label">今回は前回と何が違うか *</label>
                      <textarea className="form-textarea" value={aiForm.difference_from_last} onChange={(e) => setAIForm({ ...aiForm, difference_from_last: e.target.value })} rows={2} />
                    </div>
                  </div>
                )}
                {similar.length === 0 && <p className="text-sm text-muted">類似する過去の質問は見つかりませんでした。</p>}
                <div className="flex gap-3">
                  <button className="btn btn-ghost" onClick={() => setAIStep(1)}>← 戻る</button>
                  <button className="btn btn-primary" onClick={() => setAIStep(3)}>AIに聞いた →</button>
                </div>
              </div>
            )}

            {aiStep === 3 && (
              <div className="flex-col gap-4">
                <div className="form-group">
                  <label className="form-label">AIの回答（手入力）</label>
                  <textarea className="form-textarea" value={aiForm.ai_answer} onChange={(e) => setAIForm({ ...aiForm, ai_answer: e.target.value })} rows={5} placeholder="AIの回答を自分の言葉でメモ" />
                </div>
                <div className="flex gap-3">
                  <button className="btn btn-ghost" onClick={() => setAIStep(2)}>← 戻る</button>
                  <button className="btn btn-primary" onClick={() => setAIStep(4)}>次へ →</button>
                </div>
              </div>
            )}

            {aiStep === 4 && (
              <div className="flex-col gap-4">
                <p className="text-sm text-muted mb-2">回答を自分のものにします。すべて必須です。</p>
                <div className="form-group">
                  <label className="form-label">自分の言葉で3行要約 *</label>
                  <textarea className="form-textarea" value={aiForm.my_summary_3lines} onChange={(e) => setAIForm({ ...aiForm, my_summary_3lines: e.target.value })} rows={3} placeholder="自分の言葉で3行以内" />
                </div>
                <div className="form-group">
                  <label className="form-label">次回、自力で再現するなら最初に何をするか *</label>
                  <input className="form-input" value={aiForm.first_step_to_reproduce} onChange={(e) => setAIForm({ ...aiForm, first_step_to_reproduce: e.target.value })} placeholder="最初の一手を1行で" />
                </div>
                <div className="form-group">
                  <label className="form-label">理解段階を更新</label>
                  <div className="flex gap-2 flex-wrap">
                    {LEVELS.map((l) => (
                      <button key={l} className={`btn btn-sm ${aiForm.understanding_level_after === l ? "btn-primary" : "btn-secondary"}`} onClick={() => setAIForm({ ...aiForm, understanding_level_after: l })}>
                        {l}
                      </button>
                    ))}
                  </div>
                </div>
                {stepErr && <p className="form-error">{stepErr}</p>}
                <div className="flex-col gap-3 mt-4">
                  <div className="flex gap-3">
                    <button className="btn btn-ghost" onClick={() => setAIStep(3)}>← 戻る</button>
                    <button className="btn btn-secondary flex-1" onClick={() => handleSaveLog(false)} disabled={saving || callingGemini}>
                      {saving && !callingGemini ? "保存中…" : "そのまま保存して再確認を予約"}
                    </button>
                  </div>
                  <button 
                    className="btn flex-1" 
                    style={{ background: "var(--noise-glow)", color: "var(--noise-color)", border: "1px solid var(--noise-color)" }}
                    onClick={() => handleSaveLog(true)} 
                    disabled={saving || callingGemini}
                  >
                    {callingGemini ? "✨ AIが思考を整理中..." : "✨ Geminiで思考を整理して保存"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI log history */}
      <div className="flex-col gap-3">
        {aiLogs.map((log) => (
          <div key={log.id} className="card-sm">
            <div className="text-sm text-dim mb-2">{log.created_at ? formatTokyoDateTime(log.created_at.toDate()) : ""}</div>
            <div className="text-sm font-medium mb-1">Q: {log.what_i_know.slice(0, 80)}</div>
            {log.my_summary_3lines && <div className="text-sm text-muted mb-2">{log.my_summary_3lines}</div>}
            
            {log.golden_prompt && (
              <div className="text-xs p-2 rounded mb-2" style={{ background: "var(--noise-glow)", border: "1px solid rgba(167,139,250,0.2)" }}>
                <span style={{ color: "var(--noise-color)", fontWeight: "bold" }}>✨ 型:</span> {log.golden_prompt}
              </div>
            )}
            {log.outcome && (
              <div className="text-xs p-2 rounded mb-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                <span className="font-bold">成果:</span> {log.outcome}
              </div>
            )}

            <div className="mt-2">
              <span className={`badge badge-${log.understanding_level_after === "自力で再現できる" ? "green" : "accent"} text-sm`}>{log.understanding_level_after}</span>
            </div>
          </div>
        ))}
        {aiLogs.length === 0 && <div className="empty-state"><div className="empty-state-text">AI相談の記録はありません</div></div>}
      </div>

      <DeconstructMemoSection linkedType="sub" linkedId={sid} />
    </div>
  );
}
