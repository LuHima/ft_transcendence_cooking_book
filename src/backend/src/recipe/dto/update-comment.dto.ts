import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length } from 'class-validator';

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
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 1000)
  content: string;
}
