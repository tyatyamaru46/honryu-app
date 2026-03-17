"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { getMains, getLatestWorkLog, getNoises, getPendingReviews, updateUserProfile, startWeeklyReview, getSubs } from "@/lib/firestore";
import type { Main, Noise, Review } from "@/lib/types";
import { MAIN_NAMES } from "@/lib/types";
import { formatTokyoDate, formatTokyoDateTime, daysAgo } from "@/lib/dateUtils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { syncPublicStatus } from "@/lib/syncPublicStatus";

export default function HomePage() {
  const { user, profile, loading, signIn, refreshProfile } = useAuth();
  const [mains, setMains] = useState<Main[]>([]);
  const [saikaiMemo, setSaikaiMemo] = useState<string | null>(null);
  const [lastWorkAt, setLastWorkAt] = useState<Date | null>(null);
  const [noiseCount, setNoiseCount] = useState(0);
  const [pendingReviews, setPendingReviews] = useState<Review[]>([]);
  const [activeSubsMap, setActiveSubsMap] = useState<Record<string, number>>({});
  const [relatedNoisesMap, setRelatedNoisesMap] = useState<Record<string, number>>({});
  const [dataLoading, setDataLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [ms, wl, ns, pvs] = await Promise.all([
        getMains(user.uid),
        getLatestWorkLog(user.uid),
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

      if (wl) {
        setSaikaiMemo(wl.saikai_memo);
        setLastWorkAt(wl.created_at.toDate());
      }
      setNoiseCount(ns.filter((n) => n.status === "active").length);
      const overdue = pvs.filter((r) => {
        const d = r.scheduled_date?.toDate();
        return d && d <= new Date();
      });
      setPendingReviews(overdue);
      setDataLoading(false);
    })();
  }, [user]);

  if (loading) return <LoadingScreen />;
  if (!user) return <LoginScreen onSignIn={signIn} />;

  const reviewOverdue = profile
    ? (() => {
        // check last weekly review date by looking at profile
        return profile.weekly_review_status === "idle";
      })()
    : false;

  const setTodayFocus = async (mainId: string) => {
    if (!user) return;
    await updateUserProfile(user.uid, { today_focus_main_id: mainId as any });
    await refreshProfile();
    syncPublicStatus(user.uid); // 非同期・サイレント
  };

  const handleStartReview = async () => {
    if (!user) return;
    await startWeeklyReview(user.uid);
    await refreshProfile();
    router.push("/weekly-review");
  };

  const todayFocus = mains.find((m) => m.id === profile?.today_focus_main_id);

  return (
    <div className="fade-in">
      <div className="saikai-banner">
        <div className="saikai-banner-label">▶ 再開メモ</div>
        {saikaiMemo ? (
          <>
            <div className="saikai-banner-text">{saikaiMemo}</div>
            {lastWorkAt && (
              <div className="text-sm text-dim mt-4">{formatTokyoDateTime(lastWorkAt)}</div>
            )}
          </>
        ) : (
          <div className="saikai-banner-text text-dim" style={{ fontStyle: "italic" }}>まだありません</div>
        )}
      </div>

      {/* Weekly review nudge */}
      {profile?.weekly_review_status === "idle" && (
        <div className="review-alert">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--yellow)" }}>週次レビューの時間</div>
            <div className="text-sm text-muted">昇格・入れ替えはここでだけできます</div>
          </div>
          <button className="btn btn-sm" style={{ background: "var(--yellow)", color: "#000" }} onClick={handleStartReview}>
            始める
          </button>
        </div>
      )}
      {profile?.weekly_review_status === "active" && (
        <div className="review-alert">
          <div>
            <div className="text-sm font-medium" style={{ color: "var(--yellow)" }}>🔄 週次レビュー進行中</div>
          </div>
          <Link href="/weekly-review" className="btn btn-sm" style={{ background: "var(--yellow)", color: "#000" }}>
            再開する
          </Link>
        </div>
      )}

      {/* Stats row */}
      <div className="flex gap-3 mb-6">
        {pendingReviews.length > 0 && (
          <Link href="/reviews">
            <div className="card-sm card-hover flex items-center gap-2">
              <span className="badge badge-red">{pendingReviews.length}</span>
              <span className="text-sm">再確認待ち</span>
            </div>
          </Link>
        )}
        {noiseCount > 0 && (
          <Link href="/noises">
            <div className="card-sm card-hover flex items-center gap-2">
              <span className="badge badge-noise">{noiseCount}</span>
              <span className="text-sm">ノイズ保留中</span>
            </div>
          </Link>
        )}
      </div>

      {/* Today's focus */}
      <div className="mb-6">
        <div className="section-header">
          <div className="section-title">今日の本流</div>
        </div>
        {todayFocus ? (
          <div className="card" style={{ borderColor: "var(--accent)", background: "linear-gradient(135deg, rgba(91,124,250,0.08) 0%, var(--bg-card) 100%)" }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-xl font-bold mb-2">{todayFocus.name}</div>
                {todayFocus.next_action && (
                  <div className="text-sm" style={{ color: "var(--green)" }}>▶ {todayFocus.next_action}</div>
                )}
              </div>
              <Link href={`/mains/${todayFocus.id}`} className="btn btn-secondary btn-sm">詳細</Link>
            </div>
          </div>
        ) : (
          <div className="card" style={{ border: "1px dashed var(--border)" }}>
            <p className="text-muted text-sm text-center">今日の本流を選択してください↓</p>
          </div>
        )}
      </div>

      {/* Mains */}
      <div className="section-header mb-4">
        <div className="section-title">今週のメイン 3件</div>
      </div>
      {dataLoading ? (
        <div className="grid-3">
          {[0,1,2].map((i) => <div key={i} className="card skeleton" style={{ height: 140 }} />)}
        </div>
      ) : (
        <div className="grid-3">
          {mains.map((m) => (
            <div key={m.id} className="card flex-col gap-3" style={{ position: "relative" }}>
              {profile?.today_focus_main_id === m.id && (
                <span className="badge badge-accent" style={{ position: "absolute", top: 16, right: 16 }}>本流</span>
              )}
              <div className="font-bold text-lg border-b border-border pb-2">{m.name}</div>
              
              <div className="text-sm">
                <div className="text-muted text-xs mb-1">今週の勝ち筋</div>
                {m.win_this_week ? (
                  <div className="font-medium">{m.win_this_week}</div>
                ) : (
                  <div className="text-dim text-xs" style={{ fontStyle: "italic" }}>未設定</div>
                )}
              </div>

              <div className="text-sm" style={{ flexGrow: 1 }}>
                <div className="text-muted text-xs mb-1">次の一手</div>
                {m.next_action ? (
                  <div style={{ color: "var(--green)" }} className="font-medium">▶ {m.next_action}</div>
                ) : (
                  <div className="text-dim text-xs" style={{ fontStyle: "italic" }}>未設定</div>
                )}
              </div>

              <div className="flex justify-between items-center text-xs text-muted bg-bg-card p-2 rounded mt-2 border border-border">
                <div>サブ: <span className="font-bold" style={{ color: "var(--text)" }}>{activeSubsMap[m.id!]} / 2</span></div>
                <div>ノイズ: <span className="font-bold" style={{ color: "var(--text)" }}>{relatedNoisesMap[m.id!]}</span></div>
              </div>

              <div className="flex gap-2 mt-2">
                <Link href={`/mains/${m.id}`} className="btn btn-secondary btn-sm w-full" style={{ textAlign: "center" }}>
                  詳細
                </Link>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setTodayFocus(m.id!)}
                  title="今日の本流にする"
                >
                  ☀
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* My rules */}
      {profile?.my_rules && profile.my_rules.length > 0 && (
        <div className="mt-8">
          <div className="section-title mb-3">行動ルール</div>
          <div className="card-sm flex-col gap-2">
            {profile.my_rules.map((r, i) => (
              <div key={i} className="text-sm text-muted flex gap-2">
                <span style={{ color: "var(--accent)" }}>→</span>
                <span>{r}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="login-page">
      <div style={{ color: "var(--text-muted)" }}>読み込み中…</div>
    </div>
  );
}

function LoginScreen({ onSignIn }: { onSignIn: () => void }) {
  return (
    <div className="login-page">
      <div className="login-card fade-in">
        <div className="login-title">本流<span style={{ color: "var(--accent)" }}>守護</span></div>
        <div className="login-subtitle">
          本流を守り<br />ノイズを寝かせ<br />AIの答えを自力再現に変える
        </div>
        <button className="btn-google" onClick={onSignIn}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
          </svg>
          Googleでログイン
        </button>
      </div>
    </div>
  );
}
