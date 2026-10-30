import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDefined, ValidateNested } from 'class-validator';
import { TranslationDto } from '../../common/dto/translation.dto';

/**
 * Request body used by admins to update the translations of an existing tag.
 * The slug is immutable and cannot be changed through this endpoint.
 */
export class UpdateTagDto {
  /**
   * Display name in each supported language.
   */
  @ApiProperty({
    type: TranslationDto,
    description: 'Tag display name in Italian, English and French',
  })
  @IsDefined()
  @ValidateNested()
  @Type(() => TranslationDto)
  translations: TranslationDto;
}