import 'dotenv/config';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore, type Firestore } from 'firebase-admin/firestore';

interface SeedQuestion {
  title: string;
  language: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  points: number;
  analogy: string;
  code_template: string;
  hint: string;
  answer: string;
}

const SEED_QUESTIONS: SeedQuestion[] = [
  {
    title: 'Saring Sayuran Keranjang',
    language: 'JavaScript',
    difficulty: 'Easy',
    points: 10,
    analogy: 'Ibu pergi ke pasar untuk menyaring sayuran segar tanpa mengambil buah mangga.',
    code_template:
      'const keranjang = ["bayam", "mangga", "kangkung"];\nconst sayur = keranjang._____((item) => item !== "mangga");',
    hint: 'Gunakan method array bawaan untuk menyaring isi berdasarkan kondisi.',
    answer: 'filter',
  },
  {
    title: 'Cek Ekstensi Berkas CSV',
    language: 'Python',
    difficulty: 'Easy',
    points: 10,
    analogy: 'Sebelum mengolah data, sistem mengecek apakah nama file diakhiri ekstensi .csv.',
    code_template:
      'nama_file = "rekap_peserta.csv"\nif nama_file._____(".csv"):\n    baca_data(nama_file)',
    hint: 'Method string di Python untuk mengecek akhiran teks.',
    answer: 'endswith',
  },
  {
    title: 'Tipe Status Pengiriman',
    language: 'TypeScript',
    difficulty: 'Medium',
    points: 20,
    analogy: 'Status paket hanya diperbolehkan bernilai "PACKED" atau "SHIPPED".',
    code_template:
      'type StatusPaket = "PACKED" | "SHIPPED";\ninterface Paket {\n  resi: string;\n  status: _____;\n}',
    hint: 'Pakai tipe union yang sudah didefinisikan di atas.',
    answer: 'StatusPaket',
  },
  {
    title: 'Bandingkan Nilai Target',
    language: 'C++',
    difficulty: 'Medium',
    points: 20,
    analogy: 'Cek apakah penjumlahan dua elemen array bernilai sama persis dengan target.',
    code_template: 'if (angka[i] + angka[j] _____ target) {\n  return {i, j};\n}',
    hint: 'Operator perbandingan kesamaan nilai.',
    answer: '==',
  },
  {
    title: 'Menunggu Hasil Fetch',
    language: 'JavaScript',
    difficulty: 'Hard',
    points: 30,
    analogy: 'Tunggu respons jaringan selesai sebelum mengubah isi respons menjadi JSON.',
    code_template:
      'async function ambilSoal() {\n  try {\n    const res = _____ fetch("/api/questions");\n    return await res.json();\n  } catch (err) {\n    console.error(err);\n  }\n}',
    hint: 'Keyword di dalam fungsi async untuk menunggu Promise selesai.',
    answer: 'await',
  },
];

function initFirebase(): { auth: Auth; db: Firestore } {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) {
    throw new Error(
      'FIREBASE_PROJECT_ID belum diisi. Salin be/.env.example menjadi be/.env lalu isi kredensial Firebase (atau setel FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST untuk emulator).',
    );
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const hasCredential = Boolean(
    (privateKey && clientEmail) ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS ||
      process.env.FIREBASE_AUTH_EMULATOR_HOST,
  );
  if (!hasCredential) {
    throw new Error(
      `FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL belum diisi di be/.env. Buka console Firebase → Project settings → Service accounts → Generate new private key, lalu salin project_id, client_email, dan private_key ke file .env (private_key dengan \\n tetap seperti aslinya).`,
    );
  }

  const app =
    getApps()[0] ??
    initializeApp({
      projectId,
      credential:
        privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
    });

  return { auth: getAuth(app), db: getFirestore(app) };
}

async function ensureAccount(
  auth: Auth,
  db: Firestore,
  params: { email: string; password?: string; displayName: string; role: 'ADMIN' | 'PARTICIPANT' },
): Promise<{ uid: string; created: boolean }> {
  try {
    const user = await auth.getUserByEmail(params.email);
    await db
      .collection('participants')
      .doc(user.uid)
      .set(
        {
          display_name: params.displayName,
          email: params.email,
          role: params.role,
          created_at: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    return { uid: user.uid, created: false };
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') {
      throw error;
    }
    if (!params.password) {
      throw new Error(
        `Akun "${params.email}" belum ada dan password belum diisi. Isi password di file .env (mis. SEED_ADMIN_PASSWORD / SEED_PARTICIPANT_PASSWORD) lalu jalankan seed lagi.`,
      );
    }
    const user = await auth.createUser({
      email: params.email,
      password: params.password,
      displayName: params.displayName,
    });
    await db.collection('participants').doc(user.uid).set({
      display_name: params.displayName,
      email: params.email,
      role: params.role,
      created_at: FieldValue.serverTimestamp(),
    });
    return { uid: user.uid, created: true };
  }
}

async function ensureQuestions(db: Firestore): Promise<string[]> {
  const collection = db.collection('questions');
  const existing = await collection.get();

  if (!existing.empty) {
    const rows = existing.docs.map((doc) => ({
      id: doc.id,
      createdAt: (doc.data().created_at as Timestamp | undefined)?.toMillis?.() ?? 0,
    }));
    rows.sort((a, b) => a.createdAt - b.createdAt);
    console.log(`Bank soal sudah berisi ${rows.length} soal — memakai soal yang sudah ada.`);
    return rows.map((row) => row.id);
  }

  const baseTime = Date.now();
  const ids: string[] = [];
  for (const [index, question] of SEED_QUESTIONS.entries()) {
    const ref = collection.doc();
    await ref.set({
      title: question.title,
      language: question.language,
      difficulty: question.difficulty,
      points: question.points,
      analogy: question.analogy,
      code_template: question.code_template,
      hint: question.hint,
      is_active: true,
      created_at: Timestamp.fromMillis(baseTime + index * 1000),
    });
    await ref.collection('answers').add({
      answer_text: question.answer,
      is_case_sensitive: true,
    });
    ids.push(ref.id);
    console.log(`  + ${question.title} (${question.language} • ${question.points} pts) → kunci "${question.answer}"`);
  }
  return ids;
}

async function ensureSession(db: Firestore, questionIds: string[]): Promise<string> {
  const code = process.env.SEED_SESSION_CODE ?? 'SBK-01';
  const existing = await db
    .collection('contestSessions')
    .where('session_code', '==', code)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log(`Sesi "${code}" sudah ada — dilewati.`);
    return code;
  }

  const sessionRef = db.collection('contestSessions').doc();
  const batch = db.batch();
  batch.set(sessionRef, {
    session_code: code,
    name: 'Sesi Uji Coba SambungKode',
    duration_seconds: 900,
    status: 'ACTIVE',
    started_at: FieldValue.serverTimestamp(),
    ended_at: null,
    created_at: FieldValue.serverTimestamp(),
  });
  questionIds.forEach((questionId, index) => {
    batch.set(sessionRef.collection('questionList').doc(questionId), {
      question_id: questionId,
      sort_order: index + 1,
      custom_points: null,
    });
  });
  await batch.commit();
  console.log(`Sesi "${code}" dibuat (ACTIVE, 900 detik, ${questionIds.length} soal).`);
  return code;
}

async function main(): Promise<void> {
  console.log('=== Seed SambungKode (Firebase/Firestore) ===');
  const { auth, db } = initFirebase();

  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? 'admin@sambungkode.id';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  const participantPassword = process.env.SEED_PARTICIPANT_PASSWORD ?? 'peserta123';

  const admin = await ensureAccount(auth, db, {
    email: adminEmail,
    password: adminPassword,
    displayName: 'Panitia SambungKode',
    role: 'ADMIN',
  });
  console.log(`Admin  : ${adminEmail} (${admin.created ? 'akun baru dibuat' : 'akun sudah ada'})`);

  const participants = [
    { name: 'Raka Pratama', email: 'raka@example.com' },
    { name: 'Nadia Putri', email: 'nadia@example.com' },
  ];
  for (const participant of participants) {
    const account = await ensureAccount(auth, db, {
      email: participant.email,
      password: participantPassword,
      displayName: participant.name,
      role: 'PARTICIPANT',
    });
    console.log(`Peserta: ${participant.email} (${account.created ? 'akun baru dibuat' : 'akun sudah ada'})`);
  }

  console.log('Bank soal:');
  const questionIds = await ensureQuestions(db);

  const sessionCode = await ensureSession(db, questionIds);

  console.log('\nSelesai! Ringkasan:');
  console.log(`  Login admin     : ${adminEmail} / ${adminPassword ?? '(password lama)'}`);
  console.log(`  Login peserta   : raka@example.com & nadia@example.com / ${participantPassword}`);
  console.log(`  Kode sesi       : ${sessionCode}`);
  console.log('  Ingat: konfigurasi .env di folder be dan frontend/.env.local (lihat .env.example masing-masing).');
}

main().catch((error: unknown) => {
  console.error('\nSeed gagal:', error instanceof Error ? error.message : error);
  process.exit(1);
});
