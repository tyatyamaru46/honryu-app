"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getMains, getSubs, updateMain, setSubActive, addSub } from "@/lib/firestore";
import { syncPublicStatus } from "@/lib/syncPublicStatus";
import type { Main, Sub } from "@/lib/types";
import { Timestamp } from "firebase/firestore";
import Link from "next/link";

const UNDERSTANDING_LABELS = ["見た", "意味はわかる", "手順を言える", "自力で再現できる"] as const;
const UNDERSTANDING_LEVEL = [...UNDERSTANDING_LABELS];

export default function MainDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, profile, refreshProfile } = useAuth();
  const router = useRouter();
  const [main, setMain] = useState<Main | null>(null);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Main>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showAddSub, setShowAddSub] = useState(false);
  const [subForm, setSubForm] = useState({ name: "", purpose: "", deliverable: "", reason_to_do_now: "", next_action: "", is_active: false });
  const [subError, setSubError] = useState("");
  const [activeTab, setActiveTab] = useState<"reproducing" | "observing" | "future">("reproducing");

  useEffect(() => {
    if (!user) return;
    load();
  }, [user, id]);

  const load = async () => {
    if (!user) return;
    const [ms, ss] = await Promise.all([getMains(user.uid), getSubs(user.uid, id)]);
    const m = ms.find((m) => m.id === id) ?? null;
    setMain(m);
    if (m) setForm(m);
    setSubs(ss);
  };

  const handleSave = async () => {
    if (!user || !main) return;
    setSaving(true);
    try {
      await updateMain(user.uid, id, form as Partial<Main>);
      syncPublicStatus(user.uid); // 非同期・サイレント
      await load();
      setEditing(false);
    } catch { setError("保存に失敗しました"); }
    setSaving(false);
  };

  const handleToggleActive = async (sub: Sub) => {
    if (!user || !sub.id) return;
    try {
      await setSubActive(user.uid, id, sub.id, !sub.is_active);
      await load();
    } catch (e: any) { setError(e.message); }
  };

  const handleAddSub = async () => {
    if (!user) return;
    if (!subForm.name.trim() || !subForm.purpose.trim() || !subForm.deliverable.trim()) {
      setSubError("名前・目的・成果物は必須です");
      return;
    }
    if (subForm.is_active) {
      const activeCnt = subs.filter((s) => s.is_active).length;
      if (activeCnt >= 2) { setSubError("アクティブなサブは最大2件です"); return; }
    }
    try {
      await addSub(user.uid, id, {
        ...subForm,
        understanding_level: "見た",
        skill_bucket: id === "skill_building" ? "observing" : null,
        source_noise_id: null,
        saikai_memo: "",
        updated_at: Timestamp.now(),
      });
      setShowAddSub(false);
      setSubForm({ name: "", purpose: "", deliverable: "", reason_to_do_now: "", next_action: "", is_active: false });
      setSubError("");
      await load();
    } catch (e: any) { setSubError(e.message); }
  };

  if (!main) return <div className="text-muted">読み込み中…</div>;

  const isTech = id === "skill_building";
  const bucketSubs = isTech
    ? { reproducing: subs.filter((s) => s.skill_bucket === "reproducing"), observing: subs.filter((s) => s.skill_bucket === "observing"), future: subs.filter((s) => s.skill_bucket === "future") }
    : null;
  const displaySubs = isTech ? (bucketSubs?.[activeTab] ?? []) : subs;
  const activeSubs = subs.filter((s) => s.is_active);
  const pendingSubs = isTech ? [] : subs.filter((s) => !s.is_active);

  return (
    <div className="fade-in">
      <div className="flex items-center gap-4 mb-6">
        <button className="btn btn-ghost btn-sm" onClick={() => router.back()}>← 戻る</button>
        <h1 className="text-xl font-bold">{main.name}</h1>
        {profile?.today_focus_main_id === id && <span className="badge badge-accent">今日の本流</span>}
      </div>

      {error && <p className="form-error mb-4">{error}</p>}

      {editing ? (
        <div className="card mb-6 flex-col gap-4">
          <div className="form-group">
            <label className="form-label">目的</label>
            <textarea className="form-textarea" value={form.purpose ?? ""} onChange={(e) => setForm({ ...form, purpose: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">今週の勝ち筋</label>
            <input className="form-input" value={form.win_this_week ?? ""} onChange={(e) => setForm({ ...form, win_this_week: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">次の一手</label>
            <input className="form-input" value={form.next_action ?? ""} onChange={(e) => setForm({ ...form, next_action: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">今はやらないこと ⚠️</label>
            <textarea className="form-textarea" value={form.not_doing_now ?? ""} onChange={(e) => setForm({ ...form, not_doing_now: e.target.value })} rows={2} placeholder="これを書くことで本流を守る" />
          </div>
          <div className="form-group">
            <label className="form-label">再開メモ</label>
            <input className="form-input" value={form.saikai_memo ?? ""} onChange={(e) => setForm({ ...form, saikai_memo: e.target.value })} />
          </div>
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "保存中…" : "保存"}</button>
          </div>
        </div>
      ) : (
        <div className="card mb-6">
          <div className="flex justify-between mb-4">
            <span className="text-muted text-sm">{main.purpose}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>編集</button>
          </div>
          {main.win_this_week && <div className="mb-3"><span className="badge badge-accent">今週の勝ち筋</span><p className="mt-2 text-sm">{main.win_this_week}</p></div>}
          {main.next_action && <div className="mb-3"><span className="text-sm" style={{ color: "var(--green)" }}>▶ 次の一手: {main.next_action}</span></div>}
          {main.not_doing_now && (
            <div className="mt-3 p-3 rounded" style={{ background: "var(--red-glow)", border: "1px solid var(--red-glow)" }}>
              <div className="text-sm font-medium mb-1" style={{ color: "var(--red)" }}>🚫 今はやらないこと</div>
              <div className="text-sm">{main.not_doing_now}</div>
            </div>
          )}
          {main.saikai_memo && (
            <div className="mt-3 p-3 rounded" style={{ background: "var(--accent-glow)", border: "1px solid rgba(91,124,250,0.2)" }}>
              <div className="text-sm font-medium mb-1 text-accent">▶ 再開メモ</div>
              <div className="text-sm">{main.saikai_memo}</div>
            </div>
          )}
        </div>
      )}

      {/* Subs */}
      <div className="section-header mb-4">
        <div className="section-title">
          サブ {isTech ? "" : `（アクティブ ${activeSubs.length}/2）`}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => setShowAddSub(true)}>＋ 追加</button>
      </div>

      {isTech && (
        <div className="tabs">
          {(["reproducing", "observing", "future"] as const).map((b) => (
            <button key={b} className={`tab ${activeTab === b ? "active" : ""}`} onClick={() => setActiveTab(b)}>
              {b === "reproducing" ? `再現中（${bucketSubs?.reproducing.length ?? 0}）` : b === "observing" ? `観察中（${bucketSubs?.observing.length ?? 0}）` : `将来候補（${bucketSubs?.future.length ?? 0}）`}
            </button>
          ))}
        </div>
      )}

      {showAddSub && (
        <div className="card mb-4 flex-col gap-3">
          <div className="font-medium mb-2">新しいサブを追加</div>
          <div className="form-group">
            <label className="form-label">サブ名 *</label>
            <input className="form-input" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">目的 *</label>
            <textarea className="form-textarea" value={subForm.purpose} onChange={(e) => setSubForm({ ...subForm, purpose: e.target.value })} rows={2} />
          </div>
          <div className="form-group">
            <label className="form-label">終わった時の成果物 *</label>
            <input className="form-input" value={subForm.deliverable} onChange={(e) => setSubForm({ ...subForm, deliverable: e.target.value })} placeholder="1行で言える形" />
          </div>
          <div className="form-group">
            <label className="form-label">今やる理由</label>
            <input className="form-input" value={subForm.reason_to_do_now} onChange={(e) => setSubForm({ ...subForm, reason_to_do_now: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">次の一手</label>
            <input className="form-input" value={subForm.next_action} onChange={(e) => setSubForm({ ...subForm, next_action: e.target.value })} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={subForm.is_active} onChange={(e) => setSubForm({ ...subForm, is_active: e.target.checked })} />
            アクティブにする（最大2件）
          </label>
          {subError && <p className="form-error">{subError}</p>}
          <div className="flex gap-3">
            <button className="btn btn-secondary" onClick={() => setShowAddSub(false)}>キャンセル</button>
            <button className="btn btn-primary" onClick={handleAddSub}>追加</button>
          </div>
        </div>
      )}

      <div className="flex-col gap-3">
        {displaySubs.map((s) => (
          <div key={s.id} className="card-sm flex justify-between items-center gap-3">
            <div className="flex-col gap-1">
              <div className="flex items-center gap-2">
                {s.is_active && <span className="badge badge-green">アクティブ</span>}
                <span className="font-medium">{s.name}</span>
              </div>
              {s.next_action && <div className="text-sm" style={{ color: "var(--green)" }}>▶ {s.next_action}</div>}
              <UnderstandingBar level={s.understanding_level} />
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(s)}>
                {s.is_active ? "保留にする" : "アクティブに"}
              </button>
              <Link href={`/mains/${id}/subs/${s.id}`} className="btn btn-secondary btn-sm">詳細</Link>
            </div>
          </div>
        ))}
        {displaySubs.length === 0 && <div className="empty-state"><div className="empty-state-text">まだありません</div></div>}
      </div>

      {!isTech && pendingSubs.length > 0 && (
        <>
          <div className="divider" />
          <div className="section-title mb-3">保留中のサブ</div>
          <div className="flex-col gap-3">
            {pendingSubs.map((s) => (
              <div key={s.id} className="card-sm flex justify-between items-center gap-3" style={{ opacity: 0.7 }}>
                <div className="font-medium">{s.name}</div>
                <div className="flex gap-2">
                  <button className="btn btn-ghost btn-sm" onClick={() => handleToggleActive(s)}>アクティブに</button>
                  <Link href={`/mains/${id}/subs/${s.id}`} className="btn btn-secondary btn-sm">詳細</Link>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function UnderstandingBar({ level }: { level: string }) {
  const levels = ["見た", "意味はわかる", "手順を言える", "自力で再現できる"];
  const idx = levels.indexOf(level);
  return (
    <div className="flex items-center gap-2">
      <div className="level-bars">
        {[1,2,3,4].map((n) => <div key={n} className={`level-bar ${n <= idx + 1 ? `filled-${n}` : ""}`} />)}
      </div>
      <span className="text-sm text-dim">{level}</span>
    </div>
  );
}
