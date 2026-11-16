import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { trimString } from '../../common/dto/string-transforms';
import {
  INT32_MAX,
  VALIDATION_MESSAGES,
} from '../../common/validators/validation-constants';

/**
 * Data transfer object for adding a new comment or reply to a recipe.
 */
export class CreateCommentDto {
  /**
   * Comment text content (1 to 1000 characters).
   * @example 'Ottima ricetta, ho provato ad aggiungere un pizzico di pepe in più!'
   */
  @ApiProperty({
    description: 'Comment content text (1 to 1000 characters)',
    example:
      'Ottima ricetta, ho provato ad aggiungere un pizzico di pepe in più!',
    minLength: 1,
    maxLength: 1000,
  })
  @Transform(trimString)
  @IsString({ message: 'Comment content must be a text string' })
  @IsNotEmpty({ message: 'Comment cannot be empty' })
  @Length(1, 1000, {
    message: 'Comment must be between 1 and 1000 characters',
  })
  content: string;

  /**
   * Optional parent comment ID to reply to an existing comment.
   * If the parent comment is itself a reply, it will be normalized to the root comment ID.
   * @example 1
   */
  @ApiPropertyOptional({
    description:
      'Optional parent comment ID if this comment is a reply. Automatically normalized to root comment.',
    minimum: 1,
    maximum: INT32_MAX,
    example: 1,
  })
  @IsOptional()
  @IsInt({ message: VALIDATION_MESSAGES.idRange })
  @Min(1, { message: VALIDATION_MESSAGES.idRange })
  @Max(INT32_MAX, { message: VALIDATION_MESSAGES.idRange })
  parent_id?: number;
}
