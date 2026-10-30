import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { TranslationDto } from '../../common/dto/translation.dto';

/**
 * Request body used by admins to add a new tag to the curated catalog.
 */
export class CreateTagDto {
  /**
   * Unique canonical identifier: lowercase letters, digits and underscores.
   * @example 'gluten_free'
   */
  @ApiProperty({
    description:
      'Unique canonical slug (lowercase letters, digits, underscores)',
    example: 'gluten_free',
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:_[a-z0-9]+)*$/, {
    message:
      'slug must be lowercase snake_case (letters, digits and single underscores, e.g. gluten_free)',
  })
  slug: string;

  /**
   * Display name in each supported language.
   */
  @ApiProperty({
    type: TranslationDto,
    description: 'Tag display name in Italian, English and French',
  })
  @ValidateNested()
  @Type(() => TranslationDto)
  translations: TranslationDto;
}