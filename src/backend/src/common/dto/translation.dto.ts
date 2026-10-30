import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Toglie gli spazi a inizio/fine solo se il valore è una stringa
// (se non lo è, lo lascia com'è e ci pensa @IsString a rifiutarlo).
const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/**
 * Reusable translation payload holding one display name per supported
 * language (it, en, fr). Used by catalog entities such as ingredients and tags.
 */
export class TranslationDto {
  /**
   * Italian display name.
   * @example 'Pomodoro'
   */
  @ApiProperty({
    description: 'Italian display name',
    example: 'Pomodoro',
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  it: string;

  /**
   * English display name.
   * @example 'Tomato'
   */
  @ApiProperty({
    description: 'English display name',
    example: 'Tomato',
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  en: string;

  /**
   * French display name.
   * @example 'Tomate'
   */
  @ApiProperty({
    description: 'French display name',
    example: 'Tomate',
    maxLength: 100,
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  fr: string;
}
