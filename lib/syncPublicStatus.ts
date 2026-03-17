/**
 * syncPublicStatus.ts
 * PCで操作があった際に public_status/latest を更新する。
 * このドキュメントはスマホ（認証なし）から誰でも読める公開データ。
 */
import { db } from "./firebase";
import { doc, setDoc, Timestamp } from "firebase/firestore";
import { getMains, getSubs, getNoises, getPendingReviews, getLatestWorkLog, getUserProfile } from "./firestore";

export interface PublicStatus {
  today_focus_name: string | null;
  today_focus_next_action: string | null;
  mains: Array<{
    id: string;
    name: string;
    next_action: string;
    win_this_week: string;
    active_subs: number;
    noises: number;
  }>;
  pending_reviews_count: number;
  saikai_memo: string | null;
  updated_at: Timestamp;
}

export async function syncPublicStatus(uid: string): Promise<void> {
  try {
    const [profile, ms, ns, pvs, wl] = await Promise.all([
      getUserProfile(uid),
      getMains(uid),
      getNoises(uid),
      getPendingReviews(uid),
      getLatestWorkLog(uid),
    ]);

    const order = ["side_business", "sns_ops", "skill_building"];
    const sortedMains = [...ms].sort((a, b) => order.indexOf(a.id!) - order.indexOf(b.id!));

    // 各メインのサブ・ノイズ件数を集計
    const subsArr = await Promise.all(sortedMains.map((m) => getSubs(uid, m.id!)));
    const mainsData = sortedMains.map((m, i) => ({
      id: m.id!,
      name: m.name,
      next_action: m.next_action || "",
      win_this_week: m.win_this_week || "",
      active_subs: subsArr[i].filter((s) => s.is_active).length,
      noises: ns.filter((n) => n.related_main === m.id && n.status === "active").length,
    }));

    // 今日の本流
    const todayMain = sortedMains.find((m) => m.id === profile?.today_focus_main_id) ?? null;

    // 期限超過の再確認件数
    const overdueCount = pvs.filter((r) => {
      const d = r.scheduled_date?.toDate();
      return d && d <= new Date();
    }).length;

    const status: PublicStatus = {
      today_focus_name: todayMain?.name ?? null,
      today_focus_next_action: todayMain?.next_action ?? null,
      mains: mainsData,
      pending_reviews_count: overdueCount,
      saikai_memo: wl?.saikai_memo ?? null,
      updated_at: Timestamp.now(),
    };

    await setDoc(doc(db, "public_status", "latest"), status);
  } catch (err) {
    // サイレントに失敗してもPC操作は止めない
    console.warn("[syncPublicStatus] failed:", err);
  }
}
