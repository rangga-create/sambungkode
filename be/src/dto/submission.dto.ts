import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class SubmissionDto {
  @IsString()
  @IsNotEmpty()
  question_id: string;

  @IsString()
  @IsNotEmpty()
  submitted_answer: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  elapsed_seconds?: number;

  @IsOptional()
  @IsString()
  participant_id?: string;
}

export class ViolationDto {
  @IsIn(['TAB_SWITCH', 'EXIT_FULLSCREEN', 'WINDOW_BLUR'])
  type: 'TAB_SWITCH' | 'EXIT_FULLSCREEN' | 'WINDOW_BLUR';
}

export class UnlockViolationDto {
  @IsString()
  @IsNotEmpty()
  participant_id: string;
}
