import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class SessionQuestionDto {
  @IsString()
  @IsNotEmpty()
  question_id: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  custom_points?: number;
}

export class CreateSessionDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{2,30}$/)
  session_code: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  duration_seconds?: number;

  @IsOptional()
  @IsIn(['DRAFT', 'ACTIVE'])
  status?: 'DRAFT' | 'ACTIVE';

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => SessionQuestionDto)
  questions: SessionQuestionDto[];
}
