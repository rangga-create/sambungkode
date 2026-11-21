"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Topbar } from "@/components/Topbar";
import { useAuth } from "@/components/AuthProvider";
import { api, ApiError } from "@/lib/api";
import type {
  AdminParticipant,
  AdminQuestion,
  AdminSession,
  SubmissionHistoryRow,
  ViolationRow,
} from "@/lib/types";

type AlertKind = { type: "ok" | "bad" | "warn"; text: string };

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Terjadi kesalahan tak terduga.";
}

function poinDariLevel(level: string): number {
  return level === "Easy" ? 10 : level === "Medium" ? 20 : 30;
}

const LABEL_PELANGGARAN: Record<string, string> = {
  TAB_SWITCH: "Pindah tab",
  EXIT_FULLSCREEN: "Keluar fullscreen",
  WINDOW_BLUR: "Jendela kehilangan fokus",
};

function labelPelanggaran(type: string): string {
  return LABEL_PELANGGARAN[type] ?? type;
}

function AlertBox({ alert }: { alert: AlertKind | null }) {
  if (!alert) return null;
  return <div className={`alert show ${alert.type}`}>{alert.text}</div>;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, signOutUser } = useAuth();

  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [bank, setBank] = useState<AdminQuestion[]>([]);
  const [peserta, setPeserta] = useState<AdminParticipant[]>([]);
  const [sessions, setSessions] = useState<AdminSession[]>([]);

  const [fJudul, setFJudul] = useState("");
  const [fBahasa, setFBahasa] = useState("JavaScript");
  const [fLevel, setFLevel] = useState("Easy");
  const [fAnalogi, setFAnalogi] = useState("");
  const [fKode, setFKode] = useState("");
  const [fKunci, setFKunci] = useState("");
  const [fHint, setFHint] = useState("");
  const [pesanSoal, setPesanSoal] = useState<AlertKind | null>(null);

  const [fNamaPeserta, setFNamaPeserta] = useState("");
  const [fPasswordPeserta, setFPasswordPeserta] = useState("");
  const [pesanPeserta, setPesanPeserta] = useState<AlertKind | null>(null);

  const [fKodeSesi, setFKodeSesi] = useState("");
  const [fNamaSesi, setFNamaSesi] = useState("");
  const [fDurasiMenit, setFDurasiMenit] = useState("15");
  const [fTerpilih, setFTerpilih] = useState<string[]>([]);
  const [pesanSesi, setPesanSesi] = useState<AlertKind | null>(null);

  const [riwayatCode, setRiwayatCode] = useState("");
  const [riwayatRows, setRiwayatRows] = useState<SubmissionHistoryRow[]>([]);
  const [pelanggaranRows, setPelanggaranRows] = useState<ViolationRow[]>([]);
  const [pesanRiwayat, setPesanRiwayat] = useState<AlertKind | null>(null);

  const isAdmin = profile?.role === "ADMIN";

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!profile || profile.role !== "ADMIN") return;

    let cancelled = false;
    (async () => {
      try {
        const [bankData, pesertaData, sesiData] = await Promise.all([
          api<AdminQuestion[]>("/admin/questions"),
          api<AdminParticipant[]>("/admin/participants"),
          api<AdminSession[]>("/admin/sessions"),
        ]);
        if (cancelled) return;
        setBank(bankData);
        setPeserta(pesertaData);
        setSessions(sesiData);
        setPhase("ready");
      } catch (error) {
        if (!cancelled) {
          setPesanSoal({ type: "bad", text: errorMessage(error) });
          setPhase("ready");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, profile, router]);

  useEffect(() => {
    if (authLoading || !user || profile) return;
    const timeout = setTimeout(() => setPhase("ready"), 4000);
    return () => clearTimeout(timeout);
  }, [authLoading, user, profile]);

  async function muatBank() {
    setBank(await api<AdminQuestion[]>("/admin/questions"));
  }

  async function submitSoal(event: FormEvent) {
    event.preventDefault();
    if (!fKode.includes("_____")) {
      setPesanSoal({ type: "warn", text: "Kode harus mengandung tanda _____ sebagai bagian rumpang." });
      return;
    }
    const kunciList = fKunci.split(",").map((item) => item.trim()).filter(Boolean);
    if (kunciList.length === 0) {
      setPesanSoal({ type: "warn", text: "Isi minimal satu kunci jawaban." });
      return;
    }

    try {
      await api("/admin/questions", {
        method: "POST",
        body: {
          title: fJudul.trim(),
          language: fBahasa,
          difficulty: fLevel,
          points: poinDariLevel(fLevel),
          analogy: fAnalogi.trim(),
          code_template: fKode,
          hint: fHint.trim() || undefined,
          is_active: true,
          answers: kunciList.map((text) => ({ answer_text: text, is_case_sensitive: true })),
        },
      });
      setPesanSoal({ type: "ok", text: "Soal baru berhasil masuk ke bank soal." });
      setFJudul("");
      setFAnalogi("");
      setFKode("");
      setFKunci("");
      setFHint("");
      await muatBank();
    } catch (error) {
      setPesanSoal({ type: "bad", text: errorMessage(error) });
    }
  }

  async function submitPeserta(event: FormEvent) {
    event.preventDefault();
    try {
      const result = await api<{ message: string; data: { email: string; password: string } }>(
        "/admin/participants",
        { method: "POST", body: { display_name: fNamaPeserta.trim(), password: fPasswordPeserta } },
      );
      setPesanPeserta({
        type: "ok",
        text: `${result.message} Email: ${result.data.email} — Password: ${result.data.password}`,
      });
      setFNamaPeserta("");
      setFPasswordPeserta("");
      setPeserta(await api<AdminParticipant[]>("/admin/participants"));
    } catch (error) {
      setPesanPeserta({ type: "bad", text: errorMessage(error) });
    }
  }

  function toggleSoalSesi(questionId: string) {
    setFTerpilih((previous) =>
      previous.includes(questionId)
        ? previous.filter((id) => id !== questionId)
        : [...previous, questionId],
    );
  }

  async function submitSesi(event: FormEvent) {
    event.preventDefault();
    if (fTerpilih.length === 0) {
      setPesanSesi({ type: "warn", text: "Pilih minimal satu soal untuk sesi ini." });
      return;
    }
    const urut = [...fTerpilih].sort(
      (a, b) => bank.findIndex((question) => question.id === a) - bank.findIndex((question) => question.id === b),
    );
    try {
      await api("/admin/sessions", {
        method: "POST",
        body: {
          session_code: fKodeSesi.trim(),
          name: fNamaSesi.trim(),
          duration_seconds: Math.max(1, Number(fDurasiMenit) || 15) * 60,
          status: "DRAFT",
          questions: urut.map((questionId) => ({ question_id: questionId })),
        },
      });
      setPesanSesi({ type: "ok", text: "Sesi dibuat. Tekan Mulai untuk membuka arena." });
      setFKodeSesi("");
      setFNamaSesi("");
      setFTerpilih([]);
      setSessions(await api<AdminSession[]>("/admin/sessions"));
    } catch (error) {
      setPesanSesi({ type: "bad", text: errorMessage(error) });
    }
  }

  async function aksiSesi(code: string, aksi: "start" | "finish") {
    try {
      const result = await api<{ message: string }>(`/admin/sessions/${code}/${aksi}`, { method: "POST" });
      setPesanSesi({ type: "ok", text: result.message });
      setSessions(await api<AdminSession[]>("/admin/sessions"));
    } catch (error) {
      setPesanSesi({ type: "bad", text: errorMessage(error) });
    }
  }

  async function bukaKunci(participantId: string) {
    if (!riwayatCode) return;
    try {
      const result = await api<{ message: string }>(
        `/admin/sessions/${riwayatCode}/violations/unlock`,
        { method: "POST", body: { participant_id: participantId } },
      );
      setPesanRiwayat({ type: "ok", text: result.message });
      setPelanggaranRows(await api<ViolationRow[]>(`/admin/sessions/${riwayatCode}/violations`));
    } catch (error) {
      setPesanRiwayat({ type: "bad", text: errorMessage(error) });
    }
  }

  async function muatRiwayat(code: string) {
    setRiwayatCode(code);
    setPesanRiwayat(null);
    if (!code) {
      setRiwayatRows([]);
      setPelanggaranRows([]);
      return;
    }
    try {
      const [rows, pelanggaran] = await Promise.all([
        api<SubmissionHistoryRow[]>(`/admin/sessions/${code}/submissions`),
        api<ViolationRow[]>(`/admin/sessions/${code}/violations`),
      ]);
      setRiwayatRows(rows);
      setPelanggaranRows(pelanggaran);
    } catch (error) {
      setRiwayatRows([]);
      setPelanggaranRows([]);
      setPesanRiwayat({ type: "bad", text: errorMessage(error) });
    }
  }

  if (authLoading || !user || (!profile && phase === "loading")) {
    return (
      <>
        <Topbar />
        <main className="login-wrap">
          <section className="sheet login-card">
            <p className="muted" style={{ margin: 0 }}>
              Memeriksa akses panitia…
            </p>
          </section>
        </main>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <>
        <Topbar />
        <main className="login-wrap">
          <section className="sheet login-card">
            <h2>Akses ditolak</h2>
            <div className="alert show warn">Panel Panitia hanya untuk akun dengan peran ADMIN.</div>
            <p style={{ marginBottom: 0 }}>
              <Link href="/">← Kembali ke Mode Peserta</Link>
            </p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Topbar
        hud={
          <>
            <span>
              Panitia: <strong>{profile?.display_name ?? "—"}</strong>
            </span>
            <button type="button" className="btn-quiet" onClick={() => void signOutUser()}>
              Keluar
            </button>
          </>
        }
      />

      <main className="admin-grid">
        <section className="sheet">
          <h2>Tambah Soal ke Bank Soal</h2>
          <form className="form-stack" onSubmit={submitSoal}>
            <input
              type="text"
              placeholder="Judul soal (misal: Saring Sayur Segar)"
              value={fJudul}
              onChange={(event) => setFJudul(event.target.value)}
              required
            />
            <div className="form-row">
              <select value={fBahasa} onChange={(event) => setFBahasa(event.target.value)}>
                <option>JavaScript</option>
                <option>Python</option>
                <option>TypeScript</option>
                <option>C++</option>
                <option>Java</option>
                <option>SQL</option>
              </select>
              <select value={fLevel} onChange={(event) => setFLevel(event.target.value)}>
                <option>Easy</option>
                <option>Medium</option>
                <option>Hard</option>
              </select>
            </div>
            <span className="form-hint">Poin otomatis mengikuti level: +{poinDariLevel(fLevel)} pts</span>
            <input
              type="text"
              placeholder="Analogi: Ibu pergi ke pasar untuk _____..."
              value={fAnalogi}
              onChange={(event) => setFAnalogi(event.target.value)}
              required
            />
            <textarea
              placeholder="Tulis potongan kode dengan _____ sebagai bagian kosong..."
              value={fKode}
              onChange={(event) => setFKode(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Kunci jawaban valid (pisahkan koma jika lebih dari 1)"
              value={fKunci}
              onChange={(event) => setFKunci(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Petunjuk singkat (opsional)"
              value={fHint}
              onChange={(event) => setFHint(event.target.value)}
            />
            <button type="submit" className="btn-primary">
              Simpan Soal
            </button>
          </form>
          <AlertBox alert={pesanSoal} />
        </section>

        <section className="sheet">
          <h2>Daftar Bank Soal ({bank.length})</h2>
          <div className="list-scroll">
            {bank.length === 0 ? (
              <div className="muted">Belum ada soal. Buat soal pertama di formulir sebelah.</div>
            ) : (
              bank.map((question, index) => (
                <div className="bank-item" key={question.id}>
                  <div>
                    <strong>
                      #{index + 1} — {question.title}
                    </strong>
                  </div>
                  <div className="muted">
                    {question.language} • {question.difficulty} • {question.points} pts • Kunci:{" "}
                    <code>{question.answers.map((answer) => answer.answer_text).join(", ")}</code>
                    {!question.is_active && " • (nonaktif)"}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="sheet">
          <h2>Buat Akun Peserta</h2>
          <form className="form-stack" onSubmit={submitPeserta}>
            <input
              type="text"
              placeholder="Nama peserta (misal: Raka Pratama)"
              value={fNamaPeserta}
              onChange={(event) => setFNamaPeserta(event.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Password (min. 6 karakter)"
              value={fPasswordPeserta}
              onChange={(event) => setFPasswordPeserta(event.target.value)}
              minLength={6}
              required
            />
            <span className="form-hint">
              Email dibuat otomatis dari nama (mis. raka.pratama@peserta.sambungkode.id) dan ditampilkan
              setelah akun jadi.
            </span>
            <button type="submit" className="btn-primary">
              Buat Akun Peserta
            </button>
          </form>
          <AlertBox alert={pesanPeserta} />

          <h2 style={{ marginTop: 20 }}>Daftar Peserta ({peserta.length})</h2>
          <div className="list-scroll">
            {peserta.map((person) => (
              <div className="bank-item" key={person.uid}>
                <div>
                  <strong>{person.display_name}</strong>{" "}
                  <span className={`status-pill ${person.role === "ADMIN" ? "active" : ""}`}>
                    {person.role}
                  </span>
                </div>
                <div className="muted">{person.email}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet">
          <h2>Kelola Sesi Lomba</h2>
          <form className="form-stack" onSubmit={submitSesi}>
            <div className="form-row">
              <input
                type="text"
                placeholder="Kode sesi (misal: SBK-01)"
                value={fKodeSesi}
                onChange={(event) =>
                  setFKodeSesi(event.target.value.replace(/[^A-Za-z0-9_-]+/g, "-").slice(0, 30))
                }
                pattern="[A-Za-z0-9_-]{2,30}"
                title="Hanya huruf, angka, strip (-), dan garis bawah (_), 2–30 karakter"
                required
              />
              <input
                type="number"
                placeholder="Durasi (menit)"
                value={fDurasiMenit}
                onChange={(event) => setFDurasiMenit(event.target.value)}
                min={1}
                required
              />
            </div>
            <input
              type="text"
              placeholder="Nama sesi (misal: Babak Penyisihan SambungKode)"
              value={fNamaSesi}
              onChange={(event) => setFNamaSesi(event.target.value)}
              required
            />
            <span className="form-hint">Soal terpilih (urut sesuai daftar bank soal):</span>
            <div className="list-scroll">
              {bank.length === 0 && <div className="muted">Belum ada soal di bank soal.</div>}
              {bank.map((question) => (
                <label className="check-item" key={question.id}>
                  <input
                    type="checkbox"
                    checked={fTerpilih.includes(question.id)}
                    onChange={() => toggleSoalSesi(question.id)}
                  />
                  <span>
                    {question.title} <span className="muted">• {question.points} pts</span>
                  </span>
                </label>
              ))}
            </div>
            <button type="submit" className="btn-primary">
              Simpan Sesi (DRAFT)
            </button>
          </form>
          <AlertBox alert={pesanSesi} />

          <h2 style={{ marginTop: 20 }}>Daftar Sesi ({sessions.length})</h2>
          <div className="list-scroll">
            {sessions.length === 0 && <div className="muted">Belum ada sesi.</div>}
            {sessions.map((item) => (
              <div className="bank-item session-row" key={item.id}>
                <span className="session-pill">{item.session_code}</span>
                <span>
                  <strong>{item.name}</strong>
                </span>
                <span className={`status-pill ${item.status.toLowerCase()}`}>{item.status}</span>
                <span className="muted">
                  {item.question_count} soal • {Math.round(item.duration_seconds / 60)} mnt
                </span>
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                  {item.status !== "ACTIVE" && (
                    <button type="button" className="btn-quiet" onClick={() => void aksiSesi(item.session_code, "start")}>
                      {item.status === "FINISHED" ? "Buka Lagi" : "Mulai"}
                    </button>
                  )}
                  {item.status === "ACTIVE" && (
                    <button type="button" className="btn-quiet" onClick={() => void aksiSesi(item.session_code, "finish")}>
                      Akhiri
                    </button>
                  )}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="sheet" style={{ gridColumn: "1 / -1" }}>
          <h2>Riwayat Pengiriman Jawaban</h2>
          <div className="toolbar">
            <select
              value={riwayatCode}
              onChange={(event) => void muatRiwayat(event.target.value)}
            >
              <option value="">— Pilih sesi —</option>
              {sessions.map((item) => (
                <option key={item.id} value={item.session_code}>
                  {item.session_code} — {item.name}
                </option>
              ))}
            </select>
            <span className="muted">{riwayatRows.length} baris tercatat</span>
          </div>
          <AlertBox alert={pesanRiwayat} />
          <div className="list-scroll">
            {riwayatCode && riwayatRows.length === 0 && (
              <div className="muted">Belum ada pengiriman jawaban pada sesi ini.</div>
            )}
            {riwayatRows.map((row) => (
              <div className="hist-item" key={row.id}>
                <span>
                  <strong>{row.display_name}</strong> — {row.question_title}
                </span>
                <span>
                  jawaban: <code>{row.submitted_answer}</code>{" "}
                  <span className={row.is_correct ? "badge-true" : "badge-false"}>
                    {row.is_correct ? "BENAR" : "SALAH"}
                  </span>{" "}
                  (+{row.earned_points})
                </span>
                <span className="muted">
                  {row.submitted_at ? new Date(row.submitted_at).toLocaleString("id-ID") : ""}
                </span>
              </div>
            ))}
          </div>

          <h2 style={{ marginTop: 20 }}>Pelanggaran Anti-Cheat</h2>
          <div className="list-scroll">
            {riwayatCode && pelanggaranRows.length === 0 && (
              <div className="muted">Belum ada pelanggaran tercatat pada sesi ini.</div>
            )}
            {pelanggaranRows.map((row) => {
              const locked = row.violation_count >= 5;
              const opened = !locked && row.violation_count === 0 && row.violations.length > 0;
              return (
                <div className="hist-item" key={row.participant_id}>
                  <span>
                    <strong>{row.display_name}</strong> — {row.violation_count} pelanggaran
                  </span>
                  <span className="muted">
                    {row.violations
                      .slice(-5)
                      .map(
                        (item) =>
                          `${labelPelanggaran(item.type)} ${new Date(item.at).toLocaleTimeString("id-ID")}`,
                      )
                      .join(" • ")}
                  </span>
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <span className={locked ? "badge-false" : "badge-true"}>
                      {locked ? "TERKUNCI" : opened ? "SUDAH DIBUKA" : "AMAN"}
                    </span>
                    {locked && (
                      <button
                        type="button"
                        className="btn-quiet"
                        onClick={() => void bukaKunci(row.participant_id)}
                      >
                        Buka Kunci
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        <p className="muted" style={{ gridColumn: "1 / -1", textAlign: "center", marginBottom: 0 }}>
          Create by <strong>Angga</strong>
        </p>
      </main>
    </>
  );
}
