import type { Request } from 'express';

export type Role = 'ADMIN' | 'PARTICIPANT';

export interface ParticipantContext {
  uid: string;
  display_name: string;
  email: string | null;
  role: Role;
}

export interface AuthRequest extends Request {
  uid: string;
  email: string | null;
  participant: ParticipantContext;
}
