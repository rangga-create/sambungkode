import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { SubmissionDto } from '../dto/submission.dto';
import { FirebaseService } from '../firebase/firebase.service';
import { evaluateSubmission, type AnswerKey } from '../scoring/scoring';
import { SessionsService, type ScoreDoc } from './sessions.service';

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly firebase: FirebaseService,
    private readonly sessions: SessionsService,
  ) {}

  async submit(code: string, uid: string, dto: SubmissionDto) {
    const session = await this.sessions.requireByCode(code);

    if (session.data.status !== 'ACTIVE') {
      throw new ConflictException('Sesi lomba tidak aktif. Jawaban tidak dapat dikirim.');
    }
    if (session.data.started_at && this.sessions.remainingSeconds(session.data) <= 0) {
      throw new ConflictException('Waktu sesi sudah habis.');
    }

    const questionListEntry = await session.ref
      .collection('questionList')
      .doc(dto.question_id)
      .get();
    if (!questionListEntry.exists) {
      throw new NotFoundException('Soal tidak terdaftar pada sesi ini.');
    }

    const questionSnapshot = await this.firebase.db
      .collection('questions')
      .doc(dto.question_id)
      .get();
    if (!questionSnapshot.exists) {
      throw new NotFoundException('Soal tidak ditemukan.');
    }
    const questionData = questionSnapshot.data() ?? {};
    if (questionData.is_active === false) {
      throw new BadRequestException('Soal ini sudah tidak aktif.');
    }

    const answersSnapshot = await questionSnapshot.ref.collection('answers').get();
    const answers: AnswerKey[] = answersSnapshot.docs.map((doc) => ({
      answer_text: String(doc.data().answer_text ?? ''),
      is_case_sensitive: Boolean(doc.data().is_case_sensitive),
    }));

    const entryData = questionListEntry.data() ?? {};
    const basePoints =
      typeof entryData.custom_points === 'number'
        ? entryData.custom_points
        : Number(questionData.points ?? 0);
    const elapsedSeconds = Math.max(0, Math.floor(dto.elapsed_seconds ?? 0));

    const scoreRef = this.firebase.db.collection('sessionScores').doc(`${session.id}_${uid}`);
    const submissionRef = this.firebase.db.collection('submissions').doc();

    const result = await this.firebase.db.runTransaction(async (transaction) => {
      const scoreSnapshot = await transaction.get(scoreRef);
      const existing = scoreSnapshot.exists ? (scoreSnapshot.data() as ScoreDoc) : undefined;

      const solvedIds: string[] = existing?.solved_question_ids ?? [];
      const alreadySolved = solvedIds.includes(dto.question_id);

      const evaluation = evaluateSubmission({
        submittedAnswer: dto.submitted_answer,
        answers,
        alreadySolved,
        basePoints,
      });

      const isFirstCorrect = evaluation.isCorrect && !alreadySolved;

      const nextScore: ScoreDoc = {
        session_id: session.id,
        participant_id: uid,
        total_score: Number(existing?.total_score ?? 0) + (isFirstCorrect ? evaluation.earnedPoints : 0),
        solved_count: Number(existing?.solved_count ?? 0) + (isFirstCorrect ? 1 : 0),
        total_time_seconds: Number(existing?.total_time_seconds ?? 0) + (isFirstCorrect ? elapsedSeconds : 0),
        solved_question_ids: isFirstCorrect ? [...solvedIds, dto.question_id] : solvedIds,
        violation_count: Number(existing?.violation_count ?? 0),
        violations: existing?.violations ?? [],
        updated_at: FieldValue.serverTimestamp(),
      };

      transaction.set(scoreRef, nextScore);
      transaction.set(submissionRef, {
        session_id: session.id,
        participant_id: uid,
        question_id: dto.question_id,
        submitted_answer: dto.submitted_answer,
        is_correct: evaluation.isCorrect,
        earned_points: evaluation.earnedPoints,
        submitted_at: FieldValue.serverTimestamp(),
      });

      return { evaluation, score: nextScore };
    });

    const { evaluation, score } = result;

    return {
      message: evaluation.isCorrect
        ? 'Jawaban tepat!'
        : 'Jawaban belum tepat. Periksa kembali potongan kode atau petunjuk.',
      data: {
        submission_id: submissionRef.id,
        question_id: dto.question_id,
        is_correct: evaluation.isCorrect,
        earned_points: evaluation.earnedPoints,
        already_solved_before: evaluation.alreadySolved,
        session_score: {
          total_score: score.total_score,
          solved_count: score.solved_count,
          total_time_seconds: score.total_time_seconds,
        },
      },
    };
  }

  async recordViolation(code: string, uid: string, type: string) {
    const session = await this.sessions.requireByCode(code);

    if (session.data.status !== 'ACTIVE') {
      throw new ConflictException('Sesi lomba tidak aktif. Pelanggaran tidak dicatat.');
    }

    const scoreRef = this.firebase.db.collection('sessionScores').doc(`${session.id}_${uid}`);
    const violation = { type, at: new Date().toISOString() };

    const result = await this.firebase.db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(scoreRef);
      const existing = snapshot.exists ? (snapshot.data() as ScoreDoc) : undefined;

      const previous: ScoreDoc = existing ?? {
        session_id: session.id,
        participant_id: uid,
        total_score: 0,
        solved_count: 0,
        total_time_seconds: 0,
        solved_question_ids: [],
      };

      const violations = [...(previous.violations ?? []), violation].slice(-100);
      const violationCount = Number(previous.violation_count ?? 0) + 1;
      const nextScore: ScoreDoc = {
        ...previous,
        violation_count: violationCount,
        violations,
        updated_at: FieldValue.serverTimestamp(),
      };

      transaction.set(scoreRef, nextScore);

      return { violation_count: violationCount, total_score: Number(nextScore.total_score ?? 0) };
    });

    return {
      message: 'Pelanggaran tercatat.',
      data: {
        violation_count: result.violation_count,
        total_score: result.total_score,
        locked: result.violation_count >= 5,
      },
    };
  }
}
