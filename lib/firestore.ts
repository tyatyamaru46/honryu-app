import { db } from "./firebase";
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  addDoc,
  updateDoc,
  runTransaction,
  collectionGroup,
  query,
  where,
  orderBy,
  Timestamp,
  deleteField,
  increment,
  deleteDoc,
} from "firebase/firestore";
import type {
  Main,
  Sub,
  Noise,
  AiLog,
  Review,
  WorkLog,
  RelatedMain,
  UnderstandingLevel,
  SkillBucket,
  UserProfile,
  QuestionType,
  WeeklyReview,
  DeconstructMemo,
  MemoLinkedType,
} from "./types";
import { tokyoDate, tokyoDayStart } from "./dateUtils";
// ─── Paths ────────────────────────────────────────────────────────────────────
export const userRef = (uid: string) => doc(db, "users", uid);
export const mainsRef = (uid: string) => collection(db, "users", uid, "mains");
export const mainRef = (uid: string, mid: string) => doc(db, "users", uid, "mains", mid);
export const subsRef = (uid: string, mid: string) => collection(db, "users", uid, "mains", mid, "subs");
export const subRef = (uid: string, mid: string, sid: string) => doc(db, "users", uid, "mains", mid, "subs", sid);
export const aiLogsRef = (uid: string, mid: string, sid: string) => collection(db, "users", uid, "mains", mid, "subs", sid, "ai_logs");
export const aiLogRef = (uid: string, mid: string, sid: string, lid: string) => doc(db, "users", uid, "mains", mid, "subs", sid, "ai_logs", lid);
export const reviewsRef = (uid: string, mid: string, sid: string) => collection(db, "users", uid, "mains", mid, "subs", sid, "reviews");
export const noisesRef = (uid: string) => collection(db, "users", uid, "noises");
export const noiseRef = (uid: string, nid: string) => doc(db, "users", uid, "noises", nid);
export const weeklyReviewsRef = (uid: string) => collection(db, "users", uid, "weekly_reviews");
export const weeklyReviewRef = (uid: string, rid: string) => doc(db, "users", uid, "weekly_reviews", rid);
export const workLogsRef = (uid: string) => collection(db, "users", uid, "work_logs");

// ─── Init: idempotent first-login setup ──────────────────────────────────────
const DEFAULT_RULES = [
  "AIに聞きたくなったら、先に3行書く",
  "新機能を見つけたら、その日は触らずノイズに入れる",
  "昼休みに開いたら、ノイズではなく再開メモを見る",
  "ノイズの昇格は週次レビューまで待つ",
];

const DEFAULT_MAINS: Record<Main["id"], Omit<Main, "updated_at">> = {
  side_business: {
    id: "side_business",
    name: "副業化",
    purpose: "売れる形を作るためのメイン",
    win_this_week: "",
    next_action: "",
    not_doing_now: "",
    saikai_memo: "",
  },
  sns_ops: {
    id: "sns_ops",
    name: "発信運用",
    purpose: "SNSの型を決めて回すためのメイン",
    win_this_week: "",
    next_action: "",
    not_doing_now: "",
    saikai_memo: "",
  },
  skill_building: {
    id: "skill_building",
    name: "制作技術の習得",
    purpose: "制作に直結する技術を自力再現できる状態にする",
    win_this_week: "",
    next_action: "",
    not_doing_now: "",
    saikai_memo: "",
  },
};

export async function initUserData(uid: string) {
  const uRef = userRef(uid);
  const uSnap = await getDoc(uRef);

  if (!uSnap.exists()) {
    const profile: UserProfile = {
      today_focus_main_id: "side_business",
      review_intervals: [1, 3, 7],
      my_rules: DEFAULT_RULES,
      weekly_review_status: "idle",
      current_weekly_review_id: null,
    };
    await setDoc(uRef, profile);
  } else {
    // 既存データ（他アプリのテストデータ等）へのフェールセーフ修復
    const data = uSnap.data() as Partial<UserProfile>;
    let needsUpdate = false;
    const updates: Partial<UserProfile> = {};

    if (!data.today_focus_main_id) {
      updates.today_focus_main_id = "side_business";
      needsUpdate = true;
    }

    // weekly_review_status の整合性チェックと強制リセット
    if (data.weekly_review_status !== "idle" && data.weekly_review_status !== "active") {
      updates.weekly_review_status = "idle";
      needsUpdate = true;
    }

    if (data.weekly_review_status === "active") {
      if (!data.current_weekly_review_id) {
        // IDがない場合は強制リセット
        updates.weekly_review_status = "idle";
        needsUpdate = true;
      } else {
        // IDがある場合、その実体が存在し未完了かチェック
        const revSnap = await getDoc(weeklyReviewRef(uid, data.current_weekly_review_id));
        if (!revSnap.exists() || revSnap.data()?.completed_at) {
          updates.weekly_review_status = "idle";
          updates.current_weekly_review_id = null;
          needsUpdate = true;
        }
      }
    }

    if (needsUpdate) {
      await updateDoc(uRef, updates);
    }

    if (needsUpdate) {
      await updateDoc(uRef, updates);
    }
  }

  // Idempotently create 3 mains
  for (const mid of Object.keys(DEFAULT_MAINS) as Main["id"][]) {
    const mRef = mainRef(uid, mid);
    const mSnap = await getDoc(mRef);
    if (!mSnap.exists()) {
      await setDoc(mRef, { ...DEFAULT_MAINS[mid], updated_at: Timestamp.now() });
    }
  }

  // Idempotently create skill_building initial "reproducing" sub
  const sbSubsSnap = await getDocs(
    query(subsRef(uid, "skill_building"), where("skill_bucket", "==", "reproducing"))
  );
  if (sbSubsSnap.empty) {
    await addDoc(subsRef(uid, "skill_building"), {
      name: "DaVinci Resolve で5分ハイライト動画を自力再現する",
      purpose: "AviUtlで作っているハイライト動画と同等クオリティの5分ハイライト動画をDaVinci Resolveで自力再現できるようになる",
      deliverable: "AviUtlと遜色ないクオリティの5分ハイライト動画1本",
      reason_to_do_now: "制作技術の習得の最初の柱",
      is_active: true,
      understanding_level: "見た",
      skill_bucket: "reproducing" as SkillBucket,
      source_noise_id: null,
      next_action: "DaVinci Resolveのタイムラインにクリップを並べてみる",
      saikai_memo: "",
      updated_at: Timestamp.now(),
    } as Omit<Sub, "id">);
  }
}

// ─── User profile ─────────────────────────────────────────────────────────────
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserProfile) : null;
}
export async function updateUserProfile(uid: string, data: Partial<UserProfile>) {
  await updateDoc(userRef(uid), data);
}

// ─── Mains ───────────────────────────────────────────────────────────────────
export async function getMains(uid: string): Promise<Main[]> {
  const snap = await getDocs(mainsRef(uid));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Main));
}
export async function updateMain(uid: string, mid: string, data: Partial<Main>) {
  await updateDoc(mainRef(uid, mid), { ...data, updated_at: Timestamp.now() });
}

// ─── Subs ─────────────────────────────────────────────────────────────────────
export async function getSubs(uid: string, mid: string): Promise<Sub[]> {
  const snap = await getDocs(subsRef(uid, mid));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Sub));
}
export async function addSub(uid: string, mid: string, data: Omit<Sub, "id">): Promise<string> {
  const ref = await addDoc(subsRef(uid, mid), data);
  return ref.id;
}
export async function updateSub(uid: string, mid: string, sid: string, data: Partial<Sub>) {
  await updateDoc(subRef(uid, mid, sid), { ...data, updated_at: Timestamp.now() });
}

// Transaction: set is_active with count check
export async function setSubActive(uid: string, mid: string, sid: string, active: boolean) {
  await runTransaction(db, async (tx) => {
    if (active) {
      const subsSnap = await getDocs(query(subsRef(uid, mid), where("is_active", "==", true)));
      const alreadyActive = subsSnap.docs.filter((d) => d.id !== sid).length;
      if (alreadyActive >= 2) throw new Error("アクティブなサブは最大2件です");
    }
    tx.update(subRef(uid, mid, sid), { is_active: active, updated_at: Timestamp.now() });
  });
}

// Transaction: set skill_bucket to reproducing with count check
export async function setSkillBucket(uid: string, sid: string, bucket: SkillBucket | null) {
  await runTransaction(db, async (tx) => {
    if (bucket === "reproducing") {
      const snap = await getDocs(query(subsRef(uid, "skill_building"), where("skill_bucket", "==", "reproducing")));
      const others = snap.docs.filter((d) => d.id !== sid).length;
      if (others >= 1) throw new Error("再現中は最大1件です");
    }
    tx.update(subRef(uid, "skill_building", sid), { skill_bucket: bucket, updated_at: Timestamp.now() });
  });
}

// ─── AI Logs ─────────────────────────────────────────────────────────────────
export async function getAiLogs(uid: string, mid: string, sid: string): Promise<AiLog[]> {
  const snap = await getDocs(query(aiLogsRef(uid, mid, sid), orderBy("created_at", "desc")));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as AiLog));
}

export async function getAllAiLogs(uid: string): Promise<(AiLog & { main_id: string; sub_id: string })[]> {
  const q = query(collectionGroup(db, "ai_logs"), where("__name__", ">=", `users/${uid}`));
  const snap = await getDocs(collectionGroup(db, "ai_logs"));
  return snap.docs
    .filter((d) => d.ref.path.startsWith(`users/${uid}`))
    .map((d) => {
      const parts = d.ref.path.split("/");
      return { ...d.data(), id: d.id, main_id: parts[3], sub_id: parts[5] } as AiLog & { main_id: string; sub_id: string };
    });
}

// Save AI log + auto-generate reviews
export async function saveAiLog(
  uid: string,
  mid: string,
  sid: string,
  data: Omit<AiLog, "id" | "created_at">,
  reviewIntervals: number[]
): Promise<string> {
  const logRef = await addDoc(aiLogsRef(uid, mid, sid), {
    ...data,
    created_at: Timestamp.now(),
  });

  const questionTypes: QuestionType[] = ["3行説明", "最初の一手", "なぜその方法か"];
  const now = Date.now();
  for (let i = 0; i < reviewIntervals.length; i++) {
    const ms = reviewIntervals[i] * 24 * 60 * 60 * 1000;
    await addDoc(reviewsRef(uid, mid, sid), {
      source_ai_log_id: logRef.id,
      scheduled_date: Timestamp.fromMillis(now + ms),
      question_type: questionTypes[i % 3],
      answer: "",
      completed_at: null,
      status: "pending",
    } as Omit<Review, "id">);
  }
  return logRef.id;
}

// ─── Reviews (collectionGroup) ────────────────────────────────────────────────
export async function getPendingReviews(uid: string): Promise<Review[]> {
  const snap = await getDocs(collectionGroup(db, "reviews"));
  return snap.docs
    .filter((d) => d.ref.path.startsWith(`users/${uid}`) && d.data().status === "pending")
    .map((d) => {
      const parts = d.ref.path.split("/");
      return { ...d.data(), id: d.id, main_id: parts[3], sub_id: parts[5] } as Review;
    });
}
export async function completeReview(uid: string, mid: string, sid: string, rid: string, answer: string) {
  await updateDoc(doc(db, "users", uid, "mains", mid, "subs", sid, "reviews", rid), {
    answer,
    status: "done",
    completed_at: Timestamp.now(),
  });
}

// ─── Noises ───────────────────────────────────────────────────────────────────
export async function getNoises(uid: string): Promise<Noise[]> {
  const snap = await getDocs(query(noisesRef(uid), orderBy("created_at", "desc")));
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as Noise));
}
export async function addNoise(uid: string, data: Omit<Noise, "id" | "created_at" | "noticed_history">): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(noisesRef(uid), {
    ...data,
    noticed_history: [now], // first notice = created_at
    created_at: now,
  });
  return ref.id;
}
export async function addNoticedHistory(uid: string, nid: string) {
  const nRef = noiseRef(uid, nid);
  const snap = await getDoc(nRef);
  if (!snap.exists()) return;
  const data = snap.data() as Noise;
  const history: Timestamp[] = data.noticed_history ?? [];
  // Prevent adding more than once per day (Asia/Tokyo)
  const last = history[history.length - 1];
  if (last) {
    const lastDay = tokyoDate(last.toDate());
    const today = tokyoDate(new Date());
    if (lastDay === today) return;
  }
  await updateDoc(nRef, { noticed_history: [...history, Timestamp.now()] });
}
export async function updateNoise(uid: string, nid: string, data: Partial<Noise>) {
  await updateDoc(noiseRef(uid, nid), data);
}

// Transaction: promote noise to sub
export async function promoteNoiseToSub(
  uid: string,
  nid: string,
  mid: Main["id"],
  subData: Omit<Sub, "id" | "updated_at" | "source_noise_id">
): Promise<void> {
  await runTransaction(db, async (tx) => {
    // Check weekly review is active
    const uSnap = await tx.get(userRef(uid));
    const profile = uSnap.data() as UserProfile;
    if (profile.weekly_review_status !== "active") {
      throw new Error("週次レビュー中のみ昇格できます");
    }

    // Check noise eligibility
    const nSnap = await tx.get(noiseRef(uid, nid));
    const noise = nSnap.data() as Noise;
    const history: Timestamp[] = noise.noticed_history ?? [];
    if (history.length < 2) throw new Error("気になった回数が不足しています（2回以上必要）");
    const diffMs = history[history.length - 1].toMillis() - history[0].toMillis();
    if (diffMs < 48 * 60 * 60 * 1000) throw new Error("48時間以上の間隔が必要です");
    if (noise.related_main === "unclassified") throw new Error("関連メインを設定してください");

    // Check active sub count
    const activeSubs = await getDocs(query(subsRef(uid, mid), where("is_active", "==", true)));
    if (activeSubs.size >= 2 && subData.is_active) throw new Error("アクティブなサブは最大2件です");

    // Create sub
    const newSubRef = doc(subsRef(uid, mid));
    tx.set(newSubRef, {
      ...subData,
      source_noise_id: nid,
      updated_at: Timestamp.now(),
    } as Omit<Sub, "id">);

    // Update noise
    tx.update(noiseRef(uid, nid), { status: "promoted", promoted_to_sub_id: newSubRef.id });
  });
}

// ─── Weekly Reviews ───────────────────────────────────────────────────────────
export async function startWeeklyReview(uid: string): Promise<string> {
  return await runTransaction(db, async (tx) => {
    const uSnap = await tx.get(userRef(uid));
    const profile = uSnap.data() as UserProfile;
    if (profile.weekly_review_status === "active") {
      // Already active — return existing
      return profile.current_weekly_review_id!;
    }
    const newRef = doc(weeklyReviewsRef(uid));
    tx.set(newRef, {
      started_at: Timestamp.now(),
      main_progress: {},
      next_win_this_week: {},
      promotions: [],
      completed_at: null,
    } as Omit<WeeklyReview, "id">);
    tx.update(userRef(uid), {
      weekly_review_status: "active",
      current_weekly_review_id: newRef.id,
    });
    return newRef.id;
  });
}

export async function completeWeeklyReview(uid: string, rid: string, data: Partial<WeeklyReview>) {
  await runTransaction(db, async (tx) => {
    tx.update(weeklyReviewRef(uid, rid), { ...data, completed_at: Timestamp.now() });
    tx.update(userRef(uid), { weekly_review_status: "idle", current_weekly_review_id: null });
  });
}

export async function getWeeklyReview(uid: string, rid: string): Promise<WeeklyReview | null> {
  const snap = await getDoc(weeklyReviewRef(uid, rid));
  return snap.exists() ? ({ ...snap.data(), id: snap.id } as WeeklyReview) : null;
}

export async function updateWeeklyReview(uid: string, rid: string, data: Partial<WeeklyReview>) {
  await updateDoc(weeklyReviewRef(uid, rid), data);
}

// ─── Work Logs ────────────────────────────────────────────────────────────────
export async function addWorkLog(uid: string, data: Omit<WorkLog, "id" | "created_at">) {
  await addDoc(workLogsRef(uid), { ...data, created_at: Timestamp.now() });
}
export async function getLatestWorkLog(uid: string): Promise<WorkLog | null> {
  const snap = await getDocs(query(workLogsRef(uid), orderBy("created_at", "desc")));
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...d.data(), id: d.id } as WorkLog;
}

// ─── Deconstruct Memos ────────────────────────────────────────────────────────
export const deconstructMemosRef = (uid: string) => collection(db, "users", uid, "deconstruct_memos");
export const deconstructMemoRef = (uid: string, id: string) => doc(db, "users", uid, "deconstruct_memos", id);

export async function getDeconstructMemos(uid: string, linkedType: MemoLinkedType, linkedId: string | null): Promise<DeconstructMemo[]> {
  let q = query(deconstructMemosRef(uid), where("linkedType", "==", linkedType), orderBy("updated_at", "desc"));
  if (linkedId) {
    q = query(deconstructMemosRef(uid), where("linkedType", "==", linkedType), where("linkedId", "==", linkedId), orderBy("updated_at", "desc"));
  }
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ ...d.data(), id: d.id } as DeconstructMemo));
}

export async function addDeconstructMemo(uid: string, data: Omit<DeconstructMemo, "id" | "created_at" | "updated_at">): Promise<string> {
  const now = Timestamp.now();
  const ref = await addDoc(deconstructMemosRef(uid), {
    ...data,
    created_at: now,
    updated_at: now,
  });
  return ref.id;
}

export async function updateDeconstructMemo(uid: string, id: string, data: Partial<DeconstructMemo>) {
  await updateDoc(deconstructMemoRef(uid, id), {
    ...data,
    updated_at: Timestamp.now(),
  });
}

export async function deleteDeconstructMemo(uid: string, id: string) {
  await deleteDoc(deconstructMemoRef(uid, id));
}
