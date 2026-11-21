import { BadRequestException, Injectable } from '@nestjs/common';
import { FieldValue, type DocumentReference } from 'firebase-admin/firestore';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { FirebaseService } from '../firebase/firebase.service';

export interface AnswerPayload {
  id: string;
  answer_text: string;
  is_case_sensitive: boolean;
}

export interface AdminQuestionResponse {
  id: string;
  title: string;
  language: string;
  difficulty: string;
  points: number;
  analogy: string;
  code_template: string;
  hint: string | null;
  is_active: boolean;
  answers: AnswerPayload[];
}

@Injectable()
export class QuestionsService {
  constructor(private readonly firebase: FirebaseService) {}

  async create(dto: CreateQuestionDto) {
    if (!dto.code_template.includes('_____')) {
      throw new BadRequestException('code_template harus mengandung tanda _____ sebagai bagian rumpang.');
    }

    const db = this.firebase.db;
    const questionRef = db.collection('questions').doc();
    const answerRefs = dto.answers.map(() => questionRef.collection('answers').doc());

    const batch = db.batch();
    batch.set(questionRef, {
      title: dto.title,
      language: dto.language,
      difficulty: dto.difficulty,
      points: dto.points,
      analogy: dto.analogy,
      code_template: dto.code_template,
      hint: dto.hint ?? null,
      is_active: dto.is_active ?? true,
      created_at: FieldValue.serverTimestamp(),
    });

    dto.answers.forEach((answer, index) => {
      batch.set(answerRefs[index], {
        answer_text: answer.answer_text.trim(),
        is_case_sensitive: answer.is_case_sensitive ?? false,
      });
    });

    await batch.commit();

    const answers: AnswerPayload[] = dto.answers.map((answer, index) => ({
      id: answerRefs[index].id,
      answer_text: answer.answer_text.trim(),
      is_case_sensitive: answer.is_case_sensitive ?? false,
    }));

    return {
      message: 'Soal berhasil ditambahkan ke bank soal.',
      data: {
        id: questionRef.id,
        title: dto.title,
        language: dto.language,
        difficulty: dto.difficulty,
        points: dto.points,
        analogy: dto.analogy,
        code_template: dto.code_template,
        hint: dto.hint ?? null,
        is_active: dto.is_active ?? true,
        answers,
      },
    };
  }

  async findAllAdmin(): Promise<AdminQuestionResponse[]> {
    const snapshot = await this.firebase.db.collection('questions').get();

    return Promise.all(
      snapshot.docs.map(async (doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          title: String(data.title ?? ''),
          language: String(data.language ?? ''),
          difficulty: String(data.difficulty ?? 'Easy'),
          points: Number(data.points ?? 0),
          analogy: String(data.analogy ?? ''),
          code_template: String(data.code_template ?? ''),
          hint: (data.hint as string | null) ?? null,
          is_active: data.is_active !== false,
          answers: await this.readAnswers(doc.ref),
        };
      }),
    );
  }

  async readAnswers(questionRef: DocumentReference): Promise<AnswerPayload[]> {
    const snapshot = await questionRef.collection('answers').get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      answer_text: String(doc.data().answer_text ?? ''),
      is_case_sensitive: Boolean(doc.data().is_case_sensitive),
    }));
  }
}
