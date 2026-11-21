import { Body, Controller, Get, Post } from '@nestjs/common';
import { Roles } from '../common/roles.decorator';
import { CreateQuestionDto } from '../dto/create-question.dto';
import { QuestionsService } from './questions.service';

@Controller()
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Post('admin/questions')
  @Roles('ADMIN')
  create(@Body() dto: CreateQuestionDto) {
    return this.questions.create(dto);
  }

  @Get('admin/questions')
  @Roles('ADMIN')
  findAll() {
    return this.questions.findAllAdmin();
  }
}
