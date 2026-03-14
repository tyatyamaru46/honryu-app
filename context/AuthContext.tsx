"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import {
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  User,
} from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { initUserData, getUserProfile } from "@/lib/firestore";
import type { UserProfile } from "@/lib/types";

interface AuthCtx {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: () => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  profile: null,
  loading: true,
  signIn: async () => {},
  signOutUser: async () => {},
  refreshProfile: async () => {},
});

/** モバイル判定（スマホ・タブレット） */
function isMobile(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (u: User) => {
    await initUserData(u.uid);
    const p = await getUserProfile(u.uid);
    setProfile(p);
  };

  const refreshProfile = async () => {
    if (!user) return;
    const p = await getUserProfile(user.uid);
    setProfile(p);
  };

  useEffect(() => {
    let redirectHandled = false;

    // リダイレクトログイン後の復帰処理
    getRedirectResult(auth)
      .then(async (result) => {
        if (result?.user) {
          redirectHandled = true;
          setUser(result.user);
          await loadProfile(result.user);
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("getRedirectResult error:", err);
      });

    // 通常の認証状態変化監視
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (redirectHandled) return; // redirect 側で処理済みなら skip
      setUser(u);
      if (u) {
        await loadProfile(u);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsub;
  }, []);

  const signIn = async () => {
    if (isMobile()) {
      // モバイル: リダイレクト方式（ポップアップはブロックされやすい）
      await signInWithRedirect(auth, googleProvider);
    } else {
      // PC: ポップアップ方式
      await signInWithPopup(auth, googleProvider);
    }
  };

  const signOutUser = async () => {
    await signOut(auth);
    setUser(null);
    setProfile(null);
  };

  return (
    <Ctx.Provider value={{ user, profile, loading, signIn, signOutUser, refreshProfile }}>
      {children}
    </Ctx.Provider>
  );
}

export const useAuth = () => useContext(Ctx);
