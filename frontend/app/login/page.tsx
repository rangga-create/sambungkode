"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useAuth } from "@/components/AuthProvider";
import { auth, isFirebaseConfigured } from "@/lib/firebase";

const ERROR_MESSAGES: Record<string, string> = {
  "auth/invalid-credential": "Email atau password salah.",
  "auth/user-not-found": "Akun tidak ditemukan. Hubungi panitia untuk membuat akun.",
  "auth/wrong-password": "Password salah.",
  "auth/too-many-requests": "Terlalu banyak percobaan. Coba lagi beberapa saat lagi.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/network-request-failed": "Gagal terhubung ke Firebase. Periksa koneksi Anda.",
};

export default function LoginPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [alert, setAlert] = useState<{ type: "ok" | "bad" | "warn"; text: string } | null>(null);

  useEffect(() => {
    if (loading) return;
    if (user && profile) {
      router.replace(profile.role === "ADMIN" ? "/admin" : "/");
    }
  }, [loading, user, profile, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!auth) {
      setAlert({
        type: "warn",
        text: "Firebase belum dikonfigurasi. Isi frontend/.env.local (lihat .env.example) lalu restart dev server.",
      });
      return;
    }
    setBusy(true);
    setAlert(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email.trim(), password);
      const idToken = await credential.user.getIdToken();
      if (!idToken) {
        throw new Error("Token login kosong.");
      }
      router.replace("/");
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      setAlert({
        type: "bad",
        text: ERROR_MESSAGES[code] ?? "Login gagal. Periksa email dan password.",
      });
      setBusy(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="brand-group">
          <Image
            src="/sambungkode-logo.webp"
            alt="SambungKode"
            width={532}
            height={83}
            className="brand-logo"
          />
          <span className="session-pill">MASUK ARENA</span>
        </div>
      </header>

      <main className="login-wrap">
        <section className="sheet login-card">
          <h2>Masuk</h2>
          <form className="form-stack" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="Email (dibagikan panitia)"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
            <button type="submit" className="btn-primary" disabled={busy || !isFirebaseConfigured}>
              {busy ? "Memeriksa…" : "Masuk"}
            </button>
          </form>

          {!isFirebaseConfigured && (
            <div className="alert show warn">
              Firebase belum dikonfigurasi. Salin <code>frontend/.env.example</code> menjadi{" "}
              <code>.env.local</code> lalu isi nilai <code>NEXT_PUBLIC_FIREBASE_*</code>.
            </div>
          )}

          {alert && <div className={`alert show ${alert.type}`}>{alert.text}</div>}

          <p className="muted" style={{ lineHeight: 1.6, marginBottom: 0 }}>
            Belum punya akun? Akun peserta & admin dibuat oleh panitia lewat <strong>Panel Panitia</strong>.
            Password dapat diatur ulang oleh panitia.
          </p>

          <p className="muted" style={{ textAlign: "center", margin: "14px 0 0" }}>
            Create by <strong>Angga</strong>
          </p>
        </section>
      </main>
    </>
  );
}
