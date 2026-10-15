import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';

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
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 1000)
  content: string;

  /**
   * Optional parent comment ID to reply to an existing comment.
   * If the parent comment is itself a reply, it will be normalized to the root comment ID.
   * @example 1
   */
  @ApiPropertyOptional({
    description:
      'Optional parent comment ID if this comment is a reply. Automatically normalized to root comment.',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  parent_id?: number;
}
