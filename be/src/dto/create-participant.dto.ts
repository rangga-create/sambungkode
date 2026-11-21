import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateParticipantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  display_name: string;

  @IsString()
  @MinLength(6)
  @MaxLength(64)
  password: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}
