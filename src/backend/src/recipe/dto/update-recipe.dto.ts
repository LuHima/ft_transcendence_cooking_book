import { CreateRecipeDto } from './create-recipe.dto';
import { PartialType, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

/**
 * Data transfer object for updating an existing recipe.
 * Inherits all fields from CreateRecipeDto as optional fields.
 */
export class UpdateRecipeDto extends PartialType(CreateRecipeDto) {
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
  @IsString()
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
