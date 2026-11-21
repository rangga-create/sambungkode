import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller';
import { AdminSessionsController } from './admin-sessions.controller';
import { SessionsService } from './sessions.service';
import { SubmissionsService } from './submissions.service';

@Module({
  controllers: [SessionsController, AdminSessionsController],
  providers: [SessionsService, SubmissionsService],
})
export class SessionsModule {}
