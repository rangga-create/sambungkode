import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export class AnswerDto {
  @IsString()
  @IsNotEmpty()
  answer_text: string;

  @IsOptional()
  @IsBoolean()
  is_case_sensitive?: boolean;
}

export class CreateQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  language: string;

  @IsIn(['Easy', 'Medium', 'Hard'])
  difficulty: Difficulty;

  @IsInt()
  @Min(0)
  points: number;

  @IsString()
  @IsNotEmpty()
  analogy: string;

  @IsString()
  @IsNotEmpty()
  code_template: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  hint?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AnswerDto)
  answers: AnswerDto[];
}
