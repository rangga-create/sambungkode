import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { CreateParticipantDto } from '../dto/create-participant.dto';
import { FirebaseService } from '../firebase/firebase.service';
import type { Role } from '../common/auth.types';

@Injectable()
export class ParticipantsService {
  constructor(private readonly firebase: FirebaseService) {}

  async create(dto: CreateParticipantDto) {
    const displayName = dto.display_name.trim();
    const baseEmail = dto.email?.trim() || this.generateEmail(displayName);

    let lastError: unknown;
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const email = attempt === 0 ? baseEmail : this.withSuffix(baseEmail, attempt + 1);
      try {
        const user = await this.firebase.auth.createUser({
          email,
          password: dto.password,
          displayName,
        });

        await this.firebase.db.collection('participants').doc(user.uid).set({
          display_name: displayName,
          email,
          role: 'PARTICIPANT',
          created_at: FieldValue.serverTimestamp(),
        });

        return {
          message: 'Peserta berhasil dibuat. Bagikan email & password ini ke peserta.',
          data: {
            uid: user.uid,
            display_name: displayName,
            email,
            password: dto.password,
            role: 'PARTICIPANT',
          },
        };
      } catch (error) {
        lastError = error;
        const code = (error as { code?: string }).code;
        if (code === 'auth/email-already-exists') {
          if (dto.email) {
            throw new ConflictException('Email sudah dipakai akun lain. Gunakan email lain.');
          }
          continue;
        }
        const message = (error as Error).message ?? 'Gagal membuat peserta.';
        throw new BadRequestException(`Gagal membuat peserta: ${message}`);
      }
    }

    throw lastError instanceof Error
      ? new BadRequestException(`Gagal membuat peserta: ${lastError.message}`)
      : new BadRequestException('Gagal membuat peserta.');
  }

  async list() {
    const snapshot = await this.firebase.db.collection('participants').get();
    return snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          display_name: String(data.display_name ?? ''),
          email: (data.email as string | null) ?? null,
          role: (data.role === 'ADMIN' ? 'ADMIN' : 'PARTICIPANT') as Role,
        };
      })
      .sort((a, b) => a.display_name.localeCompare(b.display_name, 'id'));
  }

  private generateEmail(displayName: string): string {
    const slug = displayName
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '');
    const local = slug || `peserta${Date.now().toString(36)}`;
    return `${local}@peserta.sambungkode.id`;
  }

  private withSuffix(email: string, attempt: number): string {
    const [local, domain] = email.split('@');
    return `${local}-${attempt}@${domain}`;
  }
}
