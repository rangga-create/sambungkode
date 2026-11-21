import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FieldValue, Timestamp, type DocumentReference } from 'firebase-admin/firestore';
import { CreateSessionDto } from '../dto/create-session.dto';
import { FirebaseService } from '../firebase/firebase.service';

export type SessionStatus = 'DRAFT' | 'ACTIVE' | 'FINISHED';

export interface ContestSessionData {
  session_code: string;
  name: string;
  duration_seconds: number;
  status: SessionStatus;
  started_at: Timestamp | null;
  ended_at: Timestamp | null;
}

export interface SessionContext {
  id: string;
  ref: DocumentReference;
  data: ContestSessionData;
}

export interface ViolationEntry {
  type: string;
  at: string;
}

export interface ScoreDoc {
  session_id: string;
  participant_id: string;
  total_score: number;
  solved_count: number;
  total_time_seconds: number;
  solved_question_ids: string[];
  violation_count?: number;
  violations?: ViolationEntry[];
  updated_at?: FieldValue | Timestamp;
}

@Injectable()
export class SessionsService {
  constructor(private readonly firebase: FirebaseService) {}

  async findByCode(code: string): Promise<SessionContext | null> {
    const snapshot = await this.firebase.db
      .collection('contestSessions')
      .where('session_code', '==', code)
      .limit(1)
      .get();

    const doc = snapshot.docs[0];
    if (!doc) {
      return null;
    }

    return {
      id: doc.id,
      ref: doc.ref,
      data: doc.data() as ContestSessionData,
    };
  }

  async requireByCode(code: string): Promise<SessionContext> {
    const session = await this.findByCode(code);
    if (!session) {
      throw new NotFoundException('Sesi lomba tidak ditemukan.');
    }
    return session;
  }

  remainingSeconds(data: ContestSessionData): number {
    if (!data.started_at) {
      return data.duration_seconds;
    }
    const startedAt =
      data.started_at instanceof Timestamp ? data.started_at.toDate() : new Date(String(data.started_at));
    const elapsed = Math.floor((Date.now() - startedAt.getTime()) / 1000);
    return Math.max(0, data.duration_seconds - elapsed);
  }

  toSessionPayload(session: SessionContext) {
    return {
      session_code: session.data.session_code,
      name: session.data.name,
      status: session.data.status,
      remaining_seconds: this.remainingSeconds(session.data),
      duration_seconds: session.data.duration_seconds,
    };
  }

  async listActive() {
    const snapshot = await this.firebase.db.collection('contestSessions').get();
    const sessions = snapshot.docs
      .map((doc) => ({ id: doc.id, ref: doc.ref, data: doc.data() as ContestSessionData }))
      .filter((session) => session.data.status === 'ACTIVE');

    return sessions
      .map((session) => this.toSessionPayload(session))
      .sort((a, b) => a.session_code.localeCompare(b.session_code));
  }

  async getQuestions(code: string) {
    const session = await this.requireByCode(code);
    const entries = await this.readQuestionList(session.ref);

    const questionRefs = entries.map((entry) => this.firebase.db.collection('questions').doc(entry.question_id));
    const questionDocs = questionRefs.length
      ? await this.firebase.db.getAll(...questionRefs)
      : [];

    const questions = questionDocs
      .map((doc, index) => {
        const entry = entries[index];
        const data = doc.data() ?? {};
        if (data.is_active === false) {
          return null;
        }
        return {
          id: doc.id,
          order: entry.sort_order,
          title: String(data.title ?? ''),
          language: String(data.language ?? ''),
          difficulty: String(data.difficulty ?? 'Easy'),
          points: entry.custom_points ?? Number(data.points ?? 0),
          analogy: String(data.analogy ?? ''),
          code_template: String(data.code_template ?? ''),
          hint: (data.hint as string | null) ?? '',
        };
      })
      .filter((question): question is NonNullable<typeof question> => question !== null)
      .sort((a, b) => a.order - b.order);

    return {
      session: this.toSessionPayload(session),
      questions,
    };
  }

  async getLeaderboard(code: string) {
    const session = await this.requireByCode(code);
    const snapshot = await this.firebase.db
      .collection('sessionScores')
      .where('session_id', '==', session.id)
      .get();

    const rows = snapshot.docs.map((doc) => {
      const data = doc.data() as ScoreDoc;
      return {
        participant_id: data.participant_id,
        display_name: '',
        total_score: Number(data.total_score ?? 0),
        solved_count: Number(data.solved_count ?? 0),
        total_time_seconds: Number(data.total_time_seconds ?? 0),
      };
    });

    await this.attachDisplayNames(rows);

    rows.sort((a, b) => b.total_score - a.total_score || a.total_time_seconds - b.total_time_seconds);

    return rows;
  }

  async getMyScore(code: string, uid: string) {
    const session = await this.requireByCode(code);
    const snapshot = await this.firebase.db
      .collection('sessionScores')
      .doc(`${session.id}_${uid}`)
      .get();

    const data = snapshot.exists ? (snapshot.data() as ScoreDoc) : undefined;

    return {
      total_score: Number(data?.total_score ?? 0),
      solved_count: Number(data?.solved_count ?? 0),
      total_time_seconds: Number(data?.total_time_seconds ?? 0),
      solved_question_ids: data?.solved_question_ids ?? [],
      violation_count: Number(data?.violation_count ?? 0),
    };
  }

  async createSession(dto: CreateSessionDto) {
    const existing = await this.findByCode(dto.session_code);
    if (existing) {
      throw new ConflictException(`Kode sesi "${dto.session_code}" sudah dipakai sesi lain.`);
    }

    const questionIds = dto.questions.map((question) => question.question_id);
    const questionRefs = questionIds.map((id) => this.firebase.db.collection('questions').doc(id));
    const questionDocs = questionRefs.length ? await this.firebase.db.getAll(...questionRefs) : [];
    const missing = questionRefs.filter((_, index) => !questionDocs[index].exists);
    if (missing.length > 0) {
      throw new BadRequestException(`Soal tidak ditemukan: ${missing.map((ref) => ref.id).join(', ')}`);
    }

    const status = dto.status ?? 'DRAFT';
    const sessionRef = this.firebase.db.collection('contestSessions').doc();
    const batch = this.firebase.db.batch();

    batch.set(sessionRef, {
      session_code: dto.session_code,
      name: dto.name,
      duration_seconds: dto.duration_seconds ?? 900,
      status,
      started_at: status === 'ACTIVE' ? FieldValue.serverTimestamp() : null,
      ended_at: null,
      created_at: FieldValue.serverTimestamp(),
    });

    dto.questions.forEach((question, index) => {
      batch.set(sessionRef.collection('questionList').doc(question.question_id), {
        question_id: question.question_id,
        sort_order: index + 1,
        custom_points: question.custom_points ?? null,
      });
    });

    await batch.commit();

    return {
      message: 'Sesi lomba berhasil dibuat.',
      data: {
        id: sessionRef.id,
        session_code: dto.session_code,
        name: dto.name,
        duration_seconds: dto.duration_seconds ?? 900,
        status,
        question_count: dto.questions.length,
      },
    };
  }

  async listSessionsAdmin() {
    const snapshot = await this.firebase.db.collection('contestSessions').get();

    return Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data() as ContestSessionData;
        const questionList = await this.readQuestionList(doc.ref);
        return {
          id: doc.id,
          session_code: data.session_code,
          name: data.name,
          status: data.status,
          duration_seconds: data.duration_seconds,
          remaining_seconds: this.remainingSeconds(data),
          question_count: questionList.length,
        };
      }),
    );
  }

  async startSession(code: string) {
    const session = await this.requireByCode(code);
    if (session.data.status === 'ACTIVE') {
      return { message: 'Sesi sudah aktif.', data: this.toSessionPayload(session) };
    }

    await session.ref.update({
      status: 'ACTIVE',
      started_at: FieldValue.serverTimestamp(),
      ended_at: null,
    });

    const updated = await this.requireByCode(code);
    return {
      message:
        session.data.status === 'FINISHED'
          ? 'Sesi dibuka kembali (waktu penuh dihitung ulang).'
          : 'Sesi dimulai.',
      data: this.toSessionPayload(updated),
    };
  }

  async finishSession(code: string) {
    const session = await this.requireByCode(code);
    if (session.data.status === 'FINISHED') {
      return { message: 'Sesi sudah diakhiri.', data: this.toSessionPayload(session) };
    }

    await session.ref.update({
      status: 'FINISHED',
      ended_at: FieldValue.serverTimestamp(),
    });

    const updated = await this.requireByCode(code);
    return { message: 'Sesi diakhiri.', data: this.toSessionPayload(updated) };
  }

  async listSubmissions(code: string) {
    const session = await this.requireByCode(code);
    const snapshot = await this.firebase.db
      .collection('submissions')
      .where('session_id', '==', session.id)
      .limit(200)
      .get();

    const rows = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        participant_id: String(data.participant_id ?? ''),
        display_name: '',
        question_id: String(data.question_id ?? ''),
        question_title: '',
        submitted_answer: String(data.submitted_answer ?? ''),
        is_correct: Boolean(data.is_correct),
        earned_points: Number(data.earned_points ?? 0),
        submitted_at:
          data.submitted_at instanceof Timestamp ? data.submitted_at.toDate().toISOString() : null,
      };
    });

    await this.attachDisplayNames(rows);

    const questionIds = Array.from(new Set(rows.map((row) => row.question_id)));
    if (questionIds.length > 0) {
      const questionDocs = await this.firebase.db.getAll(
        ...questionIds.map((id) => this.firebase.db.collection('questions').doc(id)),
      );
      const titleById = new Map(questionDocs.map((doc) => [doc.id, String(doc.data()?.title ?? '')]));
      rows.forEach((row) => {
        row.question_title = titleById.get(row.question_id) ?? row.question_id;
      });
    }

    rows.sort((a, b) => (b.submitted_at ?? '').localeCompare(a.submitted_at ?? ''));

    return rows;
  }

  async listViolations(code: string) {
    const session = await this.requireByCode(code);
    const snapshot = await this.firebase.db
      .collection('sessionScores')
      .where('session_id', '==', session.id)
      .get();

    const rows = snapshot.docs
      .map((doc) => {
        const data = doc.data() as ScoreDoc;
        return {
          participant_id: data.participant_id,
          display_name: '',
          violation_count: Number(data.violation_count ?? 0),
          violations: (data.violations ?? []).slice(-50),
        };
      })
      .filter((row) => row.violation_count > 0 || row.violations.length > 0);

    await this.attachDisplayNames(rows);

    rows.sort((a, b) => b.violation_count - a.violation_count);

    return rows;
  }

  async unlockViolations(code: string, participantId: string) {
    const session = await this.requireByCode(code);
    const scoreRef = this.firebase.db
      .collection('sessionScores')
      .doc(`${session.id}_${participantId}`);
    const snapshot = await scoreRef.get();

    if (!snapshot.exists) {
      throw new NotFoundException('Data skor peserta tidak ditemukan pada sesi ini.');
    }

    const data = snapshot.data() as ScoreDoc;
    const previousCount = Number(data.violation_count ?? 0);

    await scoreRef.update({
      violation_count: 0,
      updated_at: FieldValue.serverTimestamp(),
    });

    return {
      message:
        previousCount > 0
          ? `Kunci dibuka. ${previousCount} pelanggaran peserta direset (riwayat tetap tersimpan).`
          : 'Peserta sudah tidak terkunci.',
      data: { participant_id: participantId, previous_count: previousCount, violation_count: 0 },
    };
  }

  async readQuestionList(
    sessionRef: DocumentReference,
  ): Promise<{ question_id: string; sort_order: number; custom_points: number | null }[]> {
    const snapshot = await sessionRef.collection('questionList').get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          question_id: String(data.question_id ?? doc.id),
          sort_order: Number(data.sort_order ?? 0),
          custom_points: typeof data.custom_points === 'number' ? data.custom_points : null,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  private async attachDisplayNames(
    rows: { participant_id: string; display_name: string }[],
  ): Promise<void> {
    const uidList = Array.from(new Set(rows.map((row) => row.participant_id).filter(Boolean)));
    if (uidList.length === 0) {
      return;
    }

    const docs = await this.firebase.db.getAll(
      ...uidList.map((uid) => this.firebase.db.collection('participants').doc(uid)),
    );
    const nameById = new Map(docs.map((doc) => [doc.id, String(doc.data()?.display_name ?? 'Peserta')]));
    rows.forEach((row) => {
      row.display_name = nameById.get(row.participant_id) ?? 'Peserta';
    });
  }
}
