import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Reusable query DTO for endpoints accepting an optional target locale.
 * Strictly validates that `lang` is one of the supported language codes: 'it', 'en', 'fr'.
 */
export class LocaleQueryDto {
  /**
   * Target localization language (it, en, fr). Defaults to author source_lang or system fallback if omitted.
   * @example 'it'
   */
  @ApiPropertyOptional({
    description:
      'Target localization language (it, en, fr). Defaults to author source_lang or system fallback if omitted.',
    enum: ['it', 'en', 'fr'],
    example: 'it',
  })
  @IsOptional()
  @IsString()
  @IsIn(['it', 'en', 'fr'], {
    message: 'lang must be one of the following values: it, en, fr',
  })
  lang?: 'it' | 'en' | 'fr';
}
