import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CreateSessionDto } from '../dto/create-session.dto';
import { UnlockViolationDto } from '../dto/submission.dto';
import { SessionsService } from './sessions.service';

@Controller()
@Roles('ADMIN')
export class AdminSessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Post('admin/sessions')
  create(@Body() dto: CreateSessionDto) {
    return this.sessions.createSession(dto);
  }

  @Get('admin/sessions')
  list() {
    return this.sessions.listSessionsAdmin();
  }

  @Post('admin/sessions/:code/start')
  start(@Param('code') code: string) {
    return this.sessions.startSession(code);
  }

  @Post('admin/sessions/:code/finish')
  finish(@Param('code') code: string) {
    return this.sessions.finishSession(code);
  }

  @Get('admin/sessions/:code/submissions')
  submissions(@Param('code') code: string) {
    return this.sessions.listSubmissions(code);
  }

  @Get('admin/sessions/:code/violations')
  violations(@Param('code') code: string) {
    return this.sessions.listViolations(code);
  }

  @Post('admin/sessions/:code/violations/unlock')
  unlock(@Param('code') code: string, @Body() dto: UnlockViolationDto) {
    return this.sessions.unlockViolations(code, dto.participant_id);
  }
}
