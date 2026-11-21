import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { FirebaseModule } from './firebase/firebase.module';
import { FirebaseAuthGuard } from './firebase/firebase-auth.guard';
import { RolesGuard } from './common/roles.guard';
import { QuestionsModule } from './questions/questions.module';
import { SessionsModule } from './sessions/sessions.module';
import { ParticipantsModule } from './participants/participants.module';

@Module({
  imports: [FirebaseModule, QuestionsModule, SessionsModule, ParticipantsModule],
  providers: [
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
