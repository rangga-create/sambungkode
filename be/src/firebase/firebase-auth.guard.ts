import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AuthRequest, ParticipantContext, Role } from '../common/auth.types';
import { FirebaseService } from './firebase.service';

export const IS_PUBLIC_KEY = 'isPublic';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly firebase: FirebaseService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    if (!this.firebase.configured) {
      throw new HttpException(
        'Backend belum dikonfigurasi dengan kredensial Firebase. Isi file .env (lihat .env.example).',
        503,
      );
    }

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const token = this.extractToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('Token tidak ditemukan. Silakan login terlebih dahulu.');
    }

    let uid: string;
    let email: string | null;
    try {
      const decoded = await this.firebase.auth.verifyIdToken(token);
      uid = decoded.uid;
      email = decoded.email ?? null;
    } catch {
      throw new UnauthorizedException('Token tidak valid atau sudah kedaluwarsa. Silakan login ulang.');
    }

    const snapshot = await this.firebase.db.collection('participants').doc(uid).get();
    if (!snapshot.exists) {
      throw new ForbiddenException('Akun ini tidak terdaftar sebagai peserta/admin. Hubungi panitia.');
    }

    const data = snapshot.data() as Partial<ParticipantContext> | undefined;
    request.uid = uid;
    request.email = email;
    request.participant = {
      uid,
      display_name: data?.display_name ?? email ?? 'Peserta',
      email: data?.email ?? email,
      role: (data?.role === 'ADMIN' ? 'ADMIN' : 'PARTICIPANT') as Role,
    };

    return true;
  }

  private extractToken(authorization?: string): string | null {
    if (!authorization) {
      return null;
    }
    const [scheme, token] = authorization.split(' ');
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      return null;
    }
    return token;
  }
}
