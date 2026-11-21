import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import type { AuthRequest } from '../common/auth.types';
import { SubmissionDto, ViolationDto } from '../dto/submission.dto';
import { SessionsService } from './sessions.service';
import { SubmissionsService } from './submissions.service';

@Controller()
export class SessionsController {
  constructor(
    private readonly sessions: SessionsService,
    private readonly submissions: SubmissionsService,
  ) {}

  @Get('sessions')
  listActive() {
    return this.sessions.listActive();
  }

  @Get('sessions/:code/questions')
  questions(@Param('code') code: string) {
    return this.sessions.getQuestions(code);
  }

  @Get('sessions/:code/leaderboard')
  leaderboard(@Param('code') code: string) {
    return this.sessions.getLeaderboard(code);
  }

  @Get('sessions/:code/my-score')
  myScore(@Param('code') code: string, @Req() req: AuthRequest) {
    return this.sessions.getMyScore(code, req.participant.uid);
  }

  @Post('sessions/:code/submissions')
  submit(@Param('code') code: string, @Req() req: AuthRequest, @Body() dto: SubmissionDto) {
    return this.submissions.submit(code, req.participant.uid, dto);
  }

  @Post('sessions/:code/violations')
  violation(@Param('code') code: string, @Req() req: AuthRequest, @Body() dto: ViolationDto) {
    return this.submissions.recordViolation(code, req.participant.uid, dto.type);
  }
}
