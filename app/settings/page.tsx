"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { updateUserProfile } from "@/lib/firestore";

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const [rules, setRules] = useState<string[]>([]);
  const [intervals, setIntervals] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (profile) {
      setRules(profile.my_rules ?? []);
      setIntervals(profile.review_intervals?.join(", ") ?? "1, 3, 7");
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMessage("");
    try {
      const parsedIntervals = intervals.split(",").map((s) => parseInt(s.trim())).filter((n) => !isNaN(n));
      await updateUserProfile(user.uid, {
        my_rules: rules.filter((r) => r.trim() !== ""),
        review_intervals: parsedIntervals.length > 0 ? parsedIntervals : [1, 3, 7],
      });
      await refreshProfile();
      setMessage("保存しました");
    } catch {
      setMessage("保存に失敗しました");
    }
    setSaving(false);
  };

  const handleRuleChange = (index: number, value: string) => {
    const newRules = [...rules];
    newRules[index] = value;
    setRules(newRules);
  };

  const addRule = () => setRules([...rules, ""]);
  const removeRule = (index: number) => setRules(rules.filter((_, i) => i !== index));

  if (!profile) return <div className="text-muted">読み込み中…</div>;

  return (
    <div className="fade-in" style={{ maxWidth: 640 }}>
      <h1 className="text-xl font-bold mb-6">設定</h1>

      <div className="card mb-6 flex-col gap-4">
        <h2 className="font-bold">行動ルール（ホーム画面に表示）</h2>
        <p className="text-sm text-dim">自分を本流に引き戻すための固定文です。</p>
        <div className="flex-col gap-2">
          {rules.map((rule, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="form-input"
                value={rule}
                onChange={(e) => handleRuleChange(i, e.target.value)}
                placeholder="ルールを入力"
              />
              <button className="btn btn-ghost" onClick={() => removeRule(i)}>🗑️</button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary w-full" onClick={addRule}>＋ ルールを追加</button>
      </div>

      <div className="card mb-6 flex-col gap-4">
        <h2 className="font-bold">AI相談の再確認間隔（日後）</h2>
        <p className="text-sm text-dim">カンマ区切りで入力します（初期値: 1, 3, 7）。<br />左から順に「3行説明」「最初の一手」「なぜその方法か」の問いが自動生成されます。</p>
        <div className="form-group">
          <input
            className="form-input"
            value={intervals}
            onChange={(e) => setIntervals(e.target.value)}
            placeholder="1, 3, 7"
          />
        </div>
      </div>

      <button className="btn btn-primary btn-lg w-full mb-6" onClick={handleSave} disabled={saving}>
        {saving ? "保存中…" : "設定を保存する"}
      </button>
      {message && <div className="text-center mt-4 mb-8 text-sm font-medium" style={{ color: message.includes("失敗") ? "var(--red)" : "var(--green)" }}>{message}</div>}

      <div className="card mb-6 flex-col gap-4" style={{ borderColor: "var(--red)" }}>
        <h2 className="font-bold" style={{ color: "var(--red)" }}>【デバッグ用】ステータス強制リセット</h2>
        <p className="text-sm text-dim">テストデータによる不整合でホーム画面の「週次レビュー進行中」が消えない場合、このボタンで強制的にリセット（idle状態に）できます。</p>
        <button 
          className="btn btn-secondary w-full" 
          onClick={async () => {
            if (!user) return;
            setSaving(true);
            try {
              await updateUserProfile(user.uid, { weekly_review_status: "idle", current_weekly_review_id: null });
              await refreshProfile();
              setMessage("ステータスをリセットしました。ホーム画面に戻ってください。");
            } catch {
              setMessage("リセット失敗");
            }
            setSaving(false);
          }}
          disabled={saving}
        >
          週次レビューステータスを強制リセット
        </button>
      </div>
    </div>
  );
}
