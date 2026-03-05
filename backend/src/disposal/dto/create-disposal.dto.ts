import {
  IsUUID,
  IsNotEmpty,
  IsString,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateDisposalDto {
  @IsUUID()
  @IsNotEmpty()
  barrelId!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(500)
  reason!: string;
}
