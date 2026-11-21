import { HttpException, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: App;
  private authInstance?: Auth;
  private dbInstance?: Firestore;

  configured = false;

  onModuleInit(): void {
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!projectId) {
      this.logger.warn(
        'FIREBASE_PROJECT_ID belum diisi. Salin .env.example menjadi .env lalu isi kredensial Firebase. Semua API akan merespons 503 sampai dikonfigurasi.',
      );
      return;
    }

    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const hasCredential = Boolean(
      (privateKey && clientEmail) ||
        process.env.GOOGLE_APPLICATION_CREDENTIALS ||
        process.env.FIREBASE_AUTH_EMULATOR_HOST,
    );

    if (!hasCredential) {
      this.logger.warn(
        `Project "${projectId}" terdeteksi, tetapi FIREBASE_PRIVATE_KEY / FIREBASE_CLIENT_EMAIL belum diisi. Salin kredensial service account dari console Firebase ke file .env. API merespons 503 sampai dikonfigurasi.`,
      );
      return;
    }

    this.app = getApps()[0] ?? initializeApp({
      projectId,
      credential:
        privateKey && clientEmail ? cert({ projectId, clientEmail, privateKey }) : applicationDefault(),
    });

    this.authInstance = getAuth(this.app);
    this.dbInstance = getFirestore(this.app);
    this.configured = true;
    this.logger.log(`Firebase terhubung ke project "${projectId}"`);
  }

  get auth(): Auth {
    if (!this.authInstance) {
      throw new HttpException(
        'Backend belum dikonfigurasi dengan kredensial Firebase. Isi file .env (lihat .env.example).',
        503,
      );
    }
    return this.authInstance;
  }

  get db(): Firestore {
    if (!this.dbInstance) {
      throw new HttpException(
        'Backend belum dikonfigurasi dengan kredensial Firebase. Isi file .env (lihat .env.example).',
        503,
      );
    }
    return this.dbInstance;
  }
}
