import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import type { AuthRequest } from '../common/auth.types';
import { Roles } from '../common/roles.decorator';
import { CreateParticipantDto } from '../dto/create-participant.dto';
import { ParticipantsService } from './participants.service';

@Controller()
export class ParticipantsController {
  constructor(private readonly participants: ParticipantsService) {}

  @Get('me')
  me(@Req() req: AuthRequest) {
    return {
      uid: req.participant.uid,
      display_name: req.participant.display_name,
      email: req.participant.email,
      role: req.participant.role,
    };
  }

  @Post('admin/participants')
  @Roles('ADMIN')
  create(@Body() dto: CreateParticipantDto) {
    return this.participants.create(dto);
  }

  @Get('admin/participants')
  @Roles('ADMIN')
  list() {
    return this.participants.list();
  }
}
