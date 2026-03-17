"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getNoises, addNoise } from "@/lib/firestore";
import type { Noise, RelatedMain } from "@/lib/types";
import { RELATED_MAIN_NAMES } from "@/lib/types";
import { formatTokyoDateTime, daysAgo } from "@/lib/dateUtils";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";

const RELATED_OPTIONS: RelatedMain[] = ["side_business", "sns_ops", "skill_building", "unclassified"];

export default function NoisesPage() {
  const { user } = useAuth();
  const [noises, setNoises] = useState<Noise[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", content: "", related_main: "unclassified" as RelatedMain, reason_not_now: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    if (!user) return;
    try {
      const ns = await getNoises(user.uid);
      setNoises(ns.filter((n) => n.status === "active"));
    } catch (err) {
      console.error("Failed to load noises:", err);
      setError("ノイズの読み込みに失敗しました（DevToolsのConsoleも参照してください）");
    }
  };

  const handleAdd = async () => {
    if (!user) return;
    if (!form.title.trim()) { setError("タイトルは必須です"); return; }
    if (!form.reason_not_now.trim()) { setError("今やらない理由は必須です"); return; }
    setSaving(true);
    try {
      const tomorrow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await addNoise(user.uid, {
        ...form,
        next_review_date: Timestamp.fromDate(tomorrow),
        promoted_to_sub_id: null,
        status: "active",
      });
      setShowNew(false);
      setForm({ title: "", content: "", related_main: "unclassified", reason_not_now: "" });
      setError("");
      await load();
    } catch { setError("保存に失敗しました"); }
    setSaving(false);
  };

  return (
    <div className="fade-in">
      <div className="section-header mb-6">
        <div>
          <h1 className="text-xl font-bold">ノイズ</h1>
          <p className="text-sm text-muted mt-1">思いついたらここに入れる。昇格は週次レビューまで待つ。</p>
        </div>
        <div className="flex gap-2">
          <Link href="/noises/new" className="btn btn-primary">＋ 新しいノイズ</Link>
        </div>
      </div>

      <div className="flex-col gap-3">
        {noises.map((n) => {
          const noticeCount = n.noticed_history?.length ?? 0;
          const canPromote = noticeCount >= 2 && n.related_main !== "unclassified";
          return (
            <Link key={n.id} href={`/noises/${n.id}`}>
              <div className="noise-card card-hover">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex-col gap-1">
                    <div className="font-medium">{n.title}</div>
                    <div className="text-sm text-muted">{n.content?.slice(0, 60)}{(n.content?.length ?? 0) > 60 ? "…" : ""}</div>
                    <div className="flex gap-2 mt-1">
                      <span className="badge badge-noise">{RELATED_MAIN_NAMES[n.related_main]}</span>
                      <span className="badge badge-muted">気になった {noticeCount}回</span>
                      {canPromote && <span className="badge badge-yellow">昇格条件充足</span>}
                    </div>
                  </div>
                  <div className="text-sm text-dim flex-shrink-0">{daysAgo(n.created_at.toDate())}日前</div>
                </div>
              </div>
            </Link>
          );
        })}
        {noises.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🌿</div>
            <div className="empty-state-text">ノイズはありません<br /><span className="text-dim">思いついたらここに入れましょう</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
