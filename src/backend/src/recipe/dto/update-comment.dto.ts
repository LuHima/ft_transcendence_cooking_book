import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Payload for updating an existing comment.
 */
export class UpdateCommentDto {
  /**
   * Updated comment content text.
   * @example 'Ho rifatto la ricetta aggiungendo un pizzico di pepe in più: fantastica!'
   */
  @ApiProperty({
    description: 'Updated comment text (maximum 1000 characters)',
    example:
      'Ho rifatto la ricetta aggiungendo un pizzico di pepe in più: fantastica!',
  })
  @Transform(({ value }: { value: unknown }): unknown =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  content: string;
}
