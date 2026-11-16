import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { trimString } from './string-transforms';

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
  @Transform(trimString)
  @IsString({ message: 'Italian translation must be a text string' })
  @IsNotEmpty({ message: 'Italian translation cannot be empty' })
  @MaxLength(100, {
    message: 'Italian translation cannot exceed 100 characters',
  })
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
  @Transform(trimString)
  @IsString({ message: 'English translation must be a text string' })
  @IsNotEmpty({ message: 'English translation cannot be empty' })
  @MaxLength(100, {
    message: 'English translation cannot exceed 100 characters',
  })
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
  @Transform(trimString)
  @IsString({ message: 'French translation must be a text string' })
  @IsNotEmpty({ message: 'French translation cannot be empty' })
  @MaxLength(100, {
    message: 'French translation cannot exceed 100 characters',
  })
  fr: string;
}
