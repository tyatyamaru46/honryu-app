"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMains, getNoises, getPendingReviews, getSubs, addNoise } from "@/lib/firestore";
import type { Main, RelatedMain, Review } from "@/lib/types";
import { RELATED_MAIN_NAMES } from "@/lib/types";
import { Timestamp } from "firebase/firestore";

export default function MobilePage() {
  const { user, profile, loading, signIn } = useAuth();
  
  // Data states
  const [mains, setMains] = useState<Main[]>([]);
  const [activeSubsMap, setActiveSubsMap] = useState<Record<string, number>>({});
  const [relatedNoisesMap, setRelatedNoisesMap] = useState<Record<string, number>>({});
  const [pendingReviewsCount, setPendingReviewsCount] = useState(0);
  const [dataLoading, setDataLoading] = useState(true);

  // Noise form states
  const [form, setForm] = useState({ title: "", related_main: "unclassified" as RelatedMain, reason_not_now: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [ms, ns, pvs] = await Promise.all([
        getMains(user.uid),
        getNoises(user.uid),
        getPendingReviews(user.uid),
      ]);
      const order: string[] = ["side_business", "sns_ops", "skill_building"];
      const sortedMains = ms.sort((a, b) => order.indexOf(a.id!) - order.indexOf(b.id!));
      setMains(sortedMains);

      const subsArr = await Promise.all(sortedMains.map((m) => getSubs(user.uid, m.id!)));
      const aMap: Record<string, number> = {};
      const nMap: Record<string, number> = {};
      sortedMains.forEach((m, i) => {
        aMap[m.id!] = subsArr[i].filter((s) => s.is_active).length;
        nMap[m.id!] = ns.filter((n) => n.related_main === m.id && n.status === "active").length;
      });
      setActiveSubsMap(aMap);
      setRelatedNoisesMap(nMap);

      const overdue = pvs.filter((r) => {
        const d = r.scheduled_date?.toDate();
        return d && d <= new Date();
      });
      setPendingReviewsCount(overdue.length);
      setDataLoading(false);
    })();
  }, [user, saving]); // Reload stats after saving a noise

  if (loading) return <div className="p-4 text-center">読み込み中…</div>;
  if (!user) {
    return (
      <div className="p-4 text-center">
        <p className="mb-4">ログインが必要です</p>
        <button className="btn btn-primary" onClick={signIn}>Googleでログイン</button>
      </div>
    );
  }

  const todayFocus = mains.find((m) => m.id === profile?.today_focus_main_id);

  const handleSaveNoise = async () => {
    if (!form.title.trim()) { setError("タイトルは必須です"); return; }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const reason = form.reason_not_now.trim() || "(スマホからクイック入力)";
      
      await addNoise(user.uid, {
        title: form.title,
        content: "",
        related_main: form.related_main,
        reason_not_now: reason,
        next_review_date: Timestamp.fromDate(nextWeek),
        promoted_to_sub_id: null,
        status: "active",
      });
      setSuccess("ノイズを追加しました");
      setForm({ title: "", related_main: "unclassified", reason_not_now: "" });
      setTimeout(() => setSuccess(""), 3000);
    } catch {
      setError("保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fade-in pb-10" style={{ maxWidth: 480, margin: "0 auto" }}>
      
      {/* 1. 今日の本流 */}
      <div className="card mb-6 mt-4" style={{ borderColor: "var(--accent)", background: "var(--bg-card)" }}>
        <div className="text-xs text-muted mb-1 font-bold" style={{ color: "var(--accent)" }}>👑 今日の本流</div>
        <div className="text-lg font-bold">
          {todayFocus ? todayFocus.name : <span className="text-dim">未設定</span>}
        </div>
        {todayFocus?.next_action && (
           <div className="text-sm mt-1" style={{ color: "var(--green)" }}>▶ {todayFocus.next_action}</div>
        )}
      </div>

      {/* 2. ノイズ最短入力 */}
      <h2 className="text-sm font-bold mb-2">💡 ノイズ手帳（最短入力）</h2>
      <div className="card mb-6 flex-col gap-3" style={{ border: "1px solid var(--noise-color)" }}>
        <input 
          className="form-input" 
          placeholder="気になったこと (必須)"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
        />
        <div className="flex gap-2">
          <select 
            className="form-select flex-1" 
            value={form.related_main} 
            onChange={(e) => setForm({ ...form, related_main: e.target.value as RelatedMain })}
          >
            {(Object.entries(RELATED_MAIN_NAMES) as [RelatedMain, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <input 
            className="form-input flex-1" 
            placeholder="今やらない理由 (任意)"
            value={form.reason_not_now}
            onChange={(e) => setForm({ ...form, reason_not_now: e.target.value })}
          />
        </div>
        
        {error && <div className="text-xs text-red-400">{error}</div>}
        {success && <div className="text-xs text-green-400">{success}</div>}
        
        <button 
          className="btn btn-sm w-full mt-1" 
          style={{ background: "var(--noise-glow)", color: "var(--noise-color)" }}
          onClick={handleSaveNoise}
          disabled={saving}
        >
          {saving ? "保存中..." : "書き留めて寝かせる"}
        </button>
      </div>

      {/* 3. 3メイン簡易状態表示 */}
      <div className="flex justify-between items-end mb-2">
        <h2 className="text-sm font-bold">📊 現在の状況</h2>
        {pendingReviewsCount > 0 && (
          <span className="badge badge-red text-xs">再確認 {pendingReviewsCount}件オーバー</span>
        )}
      </div>

      {dataLoading ? (
        <div className="card skeleton h-32"></div>
      ) : (
        <div className="flex-col gap-3">
          {mains.map(m => (
            <div key={m.id} className="card-sm flex justify-between items-center" style={{ padding: "0.75rem" }}>
              <div className="font-bold">{m.name}</div>
              <div className="flex gap-3 text-xs text-muted">
                 <span>サブ <b style={{ color: "var(--text)" }}>{activeSubsMap[m.id!]}</b></span>
                 <span>ノイズ <b style={{ color: "var(--text)" }}>{relatedNoisesMap[m.id!]}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8 text-center text-xs text-dim">
        細かな整理や週次レビューは<br/>PC画面で行ってください。
      </div>
    </div>
  );
}
