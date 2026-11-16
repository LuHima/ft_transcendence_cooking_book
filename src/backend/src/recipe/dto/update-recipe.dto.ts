import { CreateRecipeDto, CreateRecipeStepDto } from './create-recipe.dto';
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { RecipePrivacy } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/**
 * Step update DTO preserving optional existing step ID and image_url across reorder/deletion.
 */
export class UpdateRecipeStepDto extends CreateRecipeStepDto {
  @ApiPropertyOptional({
    type: Number,
    description:
      'Existing step ID used to preserve step image and translations when reordering or deleting steps',
    example: 10,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  id?: number;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description:
      'Optional existing or cleared step image URL preserved during update',
    example: '/api/media/recipes/42/step-1.webp',
  })
  @IsOptional()
  @IsString({ message: 'image_url must be a string' })
  image_url?: string | null;
}

/**
 * Data transfer object for updating an existing recipe.
 * Inherits all fields from CreateRecipeDto as optional fields.
 */
export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
  @ApiPropertyOptional({
    type: [UpdateRecipeStepDto],
    description:
      'Ordered sequence of recipe preparation steps (minimum 1 step)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'Recipe must have at least one step' })
  @ValidateNested({ each: true })
  @Type(() => UpdateRecipeStepDto)
  steps?: UpdateRecipeStepDto[];
  /**
   * Optional updated privacy visibility tier.
   * @example RecipePrivacy.friends_only
   */
  @ApiPropertyOptional({
    enum: RecipePrivacy,
    description:
      'Updated privacy tier of the recipe (public, friends_only, private)',
    example: RecipePrivacy.friends_only,
  })
  @IsOptional()
  @IsEnum(RecipePrivacy, {
    message: 'Privacy must be one of: public, friends_only, private',
  })
  privacy?: RecipePrivacy;

  /**
   * Publication and visibility state of the recipe (admin/moderator restoration).
   * @example true
   */
  @ApiPropertyOptional({
    type: Boolean,
    description: 'Publication state of the recipe (active or suspended)',
    example: true,
  })
  @IsOptional()
  @IsBoolean({ message: 'is_active must be a boolean value' })
  is_active?: boolean;

  /**
   * Optional target locale code if updating localized text directly.
   * @example 'it'
   */
  @ApiPropertyOptional({
    enum: ['it', 'en', 'fr'],
    description: 'Target locale of modified localized fields (it, en, fr)',
    example: 'it',
  })
  @IsOptional()
  @IsString({ message: 'locale must be a text string' })
  @IsIn(['it', 'en', 'fr'], { message: 'locale must be it, en, or fr' })
  locale?: string;
}

/* 
La funzione PartialType(CreateRecipeDto) fa due cose in automatico:
1.  Rende opzionali tutti i campi: Prende tutte le proprietà di
    CreateRecipeDto e vi applica l'equivalente del punto interrogativo
    di TypeScript (title?: string, description?: string, ecc.).
2.  Mantiene e adatta i validatori: Eredita tutti i decoratori di
    class-validator (come @IsString(), @IsEnum(), ecc.) aggiungendovi
    automaticamente @IsOptional(). In questo modo:
    • Se il client non invia un campo, non ci saranno errori di
      validazione (es. non richiederà @IsNotEmpty()).
    • Se il client invia quel campo per aggiornarlo, il campo verrà
      comunque validato con le stesse regole definite in CreateRecipeDto.
*/
