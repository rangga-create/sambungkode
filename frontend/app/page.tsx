"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import type {
  ArenaQuestion,
  LeaderboardRow,
  MyScore,
  QuestionsResponse,
  SessionInfo,
  SubmissionResponse,
} from "@/lib/types";

type Phase = "loading" | "ready" | "error";
type AlertKind = { type: "ok" | "bad" | "warn"; text: string };

const DIFFICULTIES = ["ALL", "Easy", "Medium", "Hard"];
const MAX_PELANGGARAN = 5;

function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = String(Math.floor(safe / 60)).padStart(2, "0");
  const seconds = String(safe % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Terjadi kesalahan tak terduga.";
}

export default function ArenaPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOutUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("loading");
  const [loadError, setLoadError] = useState("");
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [questions, setQuestions] = useState<ArenaQuestion[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [solved, setSolved] = useState<Set<string>>(new Set());
  const [skor, setSkor] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [answer, setAnswer] = useState("");
  const [alert, setAlert] = useState<AlertKind | null>(null);
  const [busy, setBusy] = useState(false);
  const [sisaDetik, setSisaDetik] = useState(0);
  const [elapsedQ, setElapsedQ] = useState(0);
  const [filterBahasa, setFilterBahasa] = useState("ALL");
  const [filterLevel, setFilterLevel] = useState("ALL");
  const [gerbang, setGerbang] = useState(false);
  const [pelanggaran, setPelanggaran] = useState(0);
  const [terkunci, setTerkunci] = useState(false);
  const pelanggaranRef = useRef(0);
  const terkunciRef = useRef(false);
  const waktuPencatatanRef = useRef(0);
  const pernahFullscreenRef = useRef(false);

  const sessionCode = session?.session_code ?? "";
  const waktuHabis = phase === "ready" && sisaDetik <= 0;

  const filtered = useMemo(() => {
    const next = questions.filter(
      (question) =>
        (filterBahasa === "ALL" || question.language === filterBahasa) &&
        (filterLevel === "ALL" || question.difficulty === filterLevel),
    );
    return next.length ? next : questions;
  }, [questions, filterBahasa, filterLevel]);

  const current = filtered.find((question) => question.id === selectedId) ?? filtered[0] ?? null;
  const idx = current ? filtered.indexOf(current) : 0;

  const languages = useMemo(() => {
    const unique = Array.from(new Set(questions.map((question) => question.language)));
    return ["ALL", ...unique];
  }, [questions]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [authLoading, user, router]);

  useEffect(() => {
    if (authLoading || !user) return;
    let cancelled = false;

    (async () => {
      try {
        const sessions = await api<SessionInfo[]>("/sessions");
        const active = sessions.find((item) => item.status === "ACTIVE") ?? sessions[0];
        if (!active) {
          if (!cancelled) {
            setLoadError("Belum ada sesi lomba aktif. Hubungi panitia untuk memulai sesi.");
            setPhase("error");
          }
          return;
        }

        const [questionRes, myScore, board] = await Promise.all([
          api<QuestionsResponse>(`/sessions/${active.session_code}/questions`),
          api<MyScore>(`/sessions/${active.session_code}/my-score`),
          api<LeaderboardRow[]>(`/sessions/${active.session_code}/leaderboard`),
        ]);

        if (cancelled) return;
        setSession(questionRes.session);
        setSisaDetik(questionRes.session.remaining_seconds);
        setQuestions(questionRes.questions);
        setSolved(new Set(myScore.solved_question_ids));
        setSkor(myScore.total_score);
        const jumlahPelanggaran = myScore.violation_count ?? 0;
        pelanggaranRef.current = jumlahPelanggaran;
        setPelanggaran(jumlahPelanggaran);
        if (jumlahPelanggaran >= MAX_PELANGGARAN) {
          terkunciRef.current = true;
          setTerkunci(true);
        }
        setLeaderboard(board);
        setPhase("ready");
      } catch (error) {
        if (!cancelled) {
          setLoadError(errorMessage(error));
          setPhase("error");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSisaDetik((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsedQ((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!sessionCode) return;
    const timer = setInterval(() => {
      api<LeaderboardRow[]>(`/sessions/${sessionCode}/leaderboard`)
        .then(setLeaderboard)
        .catch(() => undefined);
    }, 15000);
    return () => clearInterval(timer);
  }, [sessionCode]);

  useEffect(() => {
    if (!gerbang || terkunci || waktuHabis || !sessionCode) return;

    const catat = (type: "TAB_SWITCH" | "EXIT_FULLSCREEN" | "WINDOW_BLUR") => {
      if (terkunciRef.current) return;
      const now = Date.now();
      if (now - waktuPencatatanRef.current < 2000) return;
      waktuPencatatanRef.current = now;

      pelanggaranRef.current += 1;
      const jumlah = pelanggaranRef.current;
      setPelanggaran(jumlah);

      if (jumlah >= MAX_PELANGGARAN) {
        terkunciRef.current = true;
        setTerkunci(true);
        if (document.fullscreenElement) void document.exitFullscreen();
      }

      void api(`/sessions/${sessionCode}/violations`, { method: "POST", body: { type } }).catch(
        () => undefined,
      );
    };

    const onVisibility = () => {
      if (document.hidden) catat("TAB_SWITCH");
    };
    const onBlur = () => catat("WINDOW_BLUR");
    const onFullscreenChange = () => {
      if (document.fullscreenElement) {
        pernahFullscreenRef.current = true;
      } else if (pernahFullscreenRef.current) {
        catat("EXIT_FULLSCREEN");
      }
    };
    const cegah = (event: Event) => event.preventDefault();
    const cegahPaste = (event: Event) => {
      event.preventDefault();
      setAlert({ type: "warn", text: "Menempel jawaban dari luar tidak diizinkan." });
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    document.addEventListener("webkitfullscreenchange", onFullscreenChange);
    document.addEventListener("contextmenu", cegah);
    document.addEventListener("copy", cegah);
    document.addEventListener("cut", cegah);
    document.addEventListener("paste", cegahPaste);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.removeEventListener("webkitfullscreenchange", onFullscreenChange);
      document.removeEventListener("contextmenu", cegah);
      document.removeEventListener("copy", cegah);
      document.removeEventListener("cut", cegah);
      document.removeEventListener("paste", cegahPaste);
    };
  }, [gerbang, terkunci, waktuHabis, sessionCode]);

  useEffect(() => {
    if (!terkunci || !sessionCode) return;
    const timer = setInterval(() => {
      api<MyScore>(`/sessions/${sessionCode}/my-score`)
        .then((score) => {
          const jumlah = score.violation_count ?? 0;
          pelanggaranRef.current = jumlah;
          setPelanggaran(jumlah);
          if (jumlah < MAX_PELANGGARAN) {
            terkunciRef.current = false;
            setTerkunci(false);
            setGerbang(false);
            setAlert({
              type: "ok",
              text: "Panitia membuka kembali arena Anda. Masuk fullscreen lagi untuk melanjutkan.",
            });
          }
        })
        .catch(() => undefined);
    }, 8000);
    return () => clearInterval(timer);
  }, [terkunci, sessionCode]);

  async function refreshBoard() {
    if (!sessionCode) return;
    try {
      setLeaderboard(await api<LeaderboardRow[]>(`/sessions/${sessionCode}/leaderboard`));
    } catch {
      // papan skor menyusul pada polling berikutnya
    }
  }

  async function kirimJawaban() {
    if (!current || !sessionCode) return;
    const tebakan = answer.trim();
    if (!tebakan) {
      setAlert({ type: "warn", text: "Isi dulu bagian _____ sebelum mengirim jawaban." });
      return;
    }
    if (sisaDetik <= 0) {
      setAlert({ type: "warn", text: "Waktu sesi sudah habis." });
      return;
    }

    setBusy(true);
    setAlert(null);
    try {
      const result = await api<SubmissionResponse>(`/sessions/${sessionCode}/submissions`, {
        method: "POST",
        body: {
          question_id: current.id,
          submitted_answer: tebakan,
          elapsed_seconds: elapsedQ,
        },
      });

      setSkor(result.data.session_score.total_score);

      if (result.data.is_correct) {
        setSolved((previous) => new Set(previous).add(current.id));
        setAnswer("");
        if (result.data.already_solved_before && result.data.earned_points === 0) {
          setAlert({
            type: "warn",
            text: "Jawaban benar, tetapi soal ini sudah pernah bernilai sebelumnya (0 poin tambahan).",
          });
        } else {
          setAlert({
            type: "ok",
            text: `Tepat! Jawaban "${tebakan}" diterima (+${result.data.earned_points} poin).`,
          });
        }
        await refreshBoard();
      } else {
        setAlert({ type: "bad", text: result.message });
      }
    } catch (error) {
      setAlert({ type: "bad", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  }

  function handleJawabanKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      void kirimJawaban();
    }
  }

  function navigasi(langkah: number) {
    if (filtered.length === 0) return;
    const nextIndex = (idx + langkah + filtered.length) % filtered.length;
    setSelectedId(filtered[nextIndex].id);
    setElapsedQ(0);
    setAlert(null);
  }

  async function masukModeUjian() {
    try {
      const target = document.documentElement;
      if (typeof target.requestFullscreen === "function") {
        await target.requestFullscreen();
      } else {
        const webkit = target as HTMLElement & { webkitRequestFullscreen?: () => void };
        webkit.webkitRequestFullscreen?.();
      }
    } catch {
      setAlert({ type: "warn", text: "Fullscreen tidak diizinkan browser. Deteksi pindah tab tetap aktif." });
    }
    setGerbang(true);
  }

  if (authLoading || !user || (phase === "loading" && !loadError)) {
    return (
      <>
        <Topbar
          hud={
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          }
        />
        <main className="login-wrap">
          <section className="sheet login-card">
            <p className="muted" style={{ margin: 0 }}>
              Menyiapkan arena…
            </p>
          </section>
        </main>
      </>
    );
  }

  if (phase === "error") {
    return (
      <>
        <Topbar
          hud={
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          }
        />
        <main className="login-wrap">
          <section className="sheet login-card">
            <h2>Arena belum siap</h2>
            <div className="alert show warn">{loadError}</div>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              Muat ulang halaman setelah sesi tersedia atau backend terkonfigurasi.
            </p>
          </section>
        </main>
      </>
    );
  }

  if (phase === "ready" && terkunci) {
    return (
      <>
        <Topbar
          sessionCode={sessionCode}
          hud={
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          }
        />
        <main className="login-wrap">
          <section className="sheet login-card">
            <h2>Arena Dikunci</h2>
            <div className="alert show bad">
              Pelanggaran mencapai {MAX_PELANGGARAN} — jawaban dibekukan. Hubungi panitia untuk
              keterangan lebih lanjut.
            </div>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              Skor akhir tercatat: <strong>{skor} poin</strong> • {solved.size} soal selesai.
            </p>
          </section>
        </main>
      </>
    );
  }

  if (phase === "ready" && waktuHabis) {
    return (
      <>
        <Topbar
          sessionCode={sessionCode}
          hud={
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          }
        />
        <main className="login-wrap">
          <section className="sheet login-card">
            <h2>Waktu Habis</h2>
            <div className="alert show warn">
              Sesi berakhir. Jawaban terakhir yang terkirim sudah tersimpan.
            </div>
            <p className="muted" style={{ lineHeight: 1.6 }}>
              Skor akhir: <strong>{skor} poin</strong> • {solved.size} soal selesai •{" "}
              {pelanggaran} pelanggaran tercatat.
            </p>
            <div className="list-scroll">
              {leaderboard.length === 0 ? (
                <div className="muted">Belum ada skor tercatat.</div>
              ) : (
                leaderboard.map((row, index) => (
                  <div className="lb-row" key={row.participant_id}>
                    <span>
                      {index + 1}. <strong>{row.display_name}</strong>
                    </span>
                    <strong>{row.total_score} pts</strong>
                  </div>
                ))
              )}
            </div>
          </section>
        </main>
      </>
    );
  }

  if (phase === "ready" && !gerbang) {
    return (
      <>
        <Topbar
          sessionCode={sessionCode}
          hud={
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          }
        />
        <main className="login-wrap">
          <section className="sheet login-card">
            <h2>Masuk Mode Ujian</h2>
            <p className="muted" style={{ lineHeight: 1.7 }}>
              Sesi <strong>{session?.name}</strong> • {questions.length} soal • sisa waktu{" "}
              <strong>{formatClock(sisaDetik)}</strong>.
              <br />
              Layar akan masuk <strong>fullscreen</strong>. Pindah tab/jendela atau keluar
              fullscreen tercatat sebagai pelanggaran; mencapai {MAX_PELANGGARAN} pelanggaran akan
              mengunci arena.
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
              <button type="button" className="btn-primary" onClick={() => void masukModeUjian()}>
                Mulai — Masuk Fullscreen
              </button>
              <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
                Keluar
              </button>
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar
        sessionCode={sessionCode}
        hud={
          <>
            <span>
              Peserta: <strong>{profile?.display_name ?? "—"}</strong>
            </span>
            <span>
              Skor: <strong>{skor}</strong>
            </span>
            <span>
              Sisa Waktu: <strong>{formatClock(sisaDetik)}</strong>
            </span>
            {pelanggaran > 0 && (
              <span style={{ color: "var(--bad)", fontWeight: 700 }}>
                Pelanggaran: <strong>{pelanggaran}/{MAX_PELANGGARAN}</strong>
              </span>
            )}
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          </>
        }
      />

      <main className="layout">
        <section className="sheet">
          <div className="toolbar">
            <select
              value={filterBahasa}
              onChange={(event) => {
                setFilterBahasa(event.target.value);
                setSelectedId(null);
                setElapsedQ(0);
              }}
            >
              {languages.map((language) => (
                <option key={language} value={language}>
                  {language === "ALL" ? "Semua bahasa" : language}
                </option>
              ))}
            </select>
            <select
              value={filterLevel}
              onChange={(event) => {
                setFilterLevel(event.target.value);
                setSelectedId(null);
                setElapsedQ(0);
              }}
            >
              {DIFFICULTIES.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty === "ALL" ? "Semua level" : difficulty}
                </option>
              ))}
            </select>
            <button type="button" onClick={() => navigasi(-1)}>
              ← Prev
            </button>
            <button type="button" onClick={() => navigasi(1)}>
              Next →
            </button>
          </div>

          {filtered.length === 0 ? (
            <div className="alert show warn">Belum ada soal pada sesi ini.</div>
          ) : (
            <>
              <div className="q-strip">
                {filtered.map((question, index) => {
                  const classes = ["q-chip"];
                  if (index === idx) classes.push("current");
                  if (solved.has(question.id)) classes.push("solved");
  return (
                    <button
                      type="button"
                      key={question.id}
                      className={classes.join(" ")}
                      onClick={() => {
                        setSelectedId(question.id);
                        setElapsedQ(0);
                        setAlert(null);
                      }}
                    >
                      #{index + 1}
                    </button>
                  );
                })}
              </div>

              <div className="q-header">
                <span className="q-title">{current?.title}</span>
                <span className="q-meta">
                  {current?.language} • {current?.difficulty} • +{current?.points} pts
                </span>
              </div>

              <div className="context-box">
                <span className="context-label">Analogi Logika</span>
                <span>{current?.analogy}</span>
              </div>

              <pre>
                {current?.code_template.split("_____").map((part, index, parts) => (
                  <span key={index}>
                    {part}
                    {index < parts.length - 1 && <span className="blank-slot">_____</span>}
                  </span>
                ))}
              </pre>

              <div className="submit-row">
                <input
                  type="text"
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  onKeyDown={handleJawabanKey}
                  placeholder="Ketik potongan pengganti _____ ..."
                  autoComplete="off"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => void kirimJawaban()}
                  disabled={busy || sisaDetik <= 0}
                >
                  {busy ? "Mengirim…" : "Kirim Jawaban"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setAlert({
                      type: "warn",
                      text:
                        current?.hint ||
                        "Perhatikan konteks logika dan tipe data pada baris kode.",
                    })
                  }
                >
                  Petunjuk
                </button>
              </div>

              {sisaDetik <= 0 && (
                <div className="alert show bad">Waktu sesi sudah habis. Pengiriman jawaban ditutup.</div>
              )}
              {alert && <div className={`alert show ${alert.type}`}>{alert.text}</div>}
            </>
          )}
        </section>

        <aside className="side-col">
          <section className="sheet">
            <h2>Papan Skor Sementara</h2>
            <div className="list-scroll">
              {leaderboard.length === 0 ? (
                <div className="muted">Belum ada skor tercatat.</div>
              ) : (
                leaderboard.map((row, index) => (
                  <div className="lb-row" key={row.participant_id}>
                    <span>
                      {index + 1}. <strong>{row.display_name}</strong>{" "}
                      <span className="muted">({row.total_time_seconds}d)</span>
                    </span>
                    <strong>{row.total_score} pts</strong>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="sheet">
            <h2>Aturan Singkat</h2>
            <div className="muted" style={{ lineHeight: 1.6 }}>
              1. Lengkapi bagian bertanda <code>_____</code> sesuai konteks dan bahasa.
              <br />
              2. Satu soal hanya memberi poin pada jawaban benar pertama.
              <br />
              3. Urutan papan skor ditentukan oleh total poin, lalu waktu tercepat.
              <br />
              4. Pindah tab/jendela atau keluar fullscreen tercatat sebagai pelanggaran;{" "}
              {MAX_PELANGGARAN} pelanggaran mengunci arena.
              <div className="muted" style={{ marginTop: 10, textAlign: "center" }}>
                Create by <strong>Angga</strong>
              </div>
            </div>
          </section>
        </aside>
      </main>
    </>
  );
}
