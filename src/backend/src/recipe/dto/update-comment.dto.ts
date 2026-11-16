import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';
import { trimString } from '../../common/dto/string-transforms';

/**
 * Payload for updating an existing comment.
 */
export class UpdateCommentDto {
  /**
   * Updated comment content text.
   * @example 'Ho rifatto la ricetta aggiungendo un pizzico di pepe in più: fantastica!'
   */
  @ApiProperty({
    description: 'Updated comment text (1 to 1000 characters)',
    example:
      'Ho rifatto la ricetta aggiungendo un pizzico di pepe in più: fantastica!',
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
}
