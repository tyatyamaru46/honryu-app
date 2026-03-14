import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import NavBar from "@/components/NavBar";

export const metadata: Metadata = {
  title: "本流守護",
  description: "本流を守り、ノイズを寝かせ、AIの答えを自力再現に変える個人専用アプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "本流守護",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  themeColor: "#0f1117",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <AuthProvider>
          <div className="app-shell">
            <NavBar />
            <main className="main-content fade-in">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}
