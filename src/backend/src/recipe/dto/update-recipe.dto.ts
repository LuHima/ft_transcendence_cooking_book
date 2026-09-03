import { CreateRecipeDto } from "./create-recipe.dto";
import {PartialType} from "@nestjs/mapped-types"
export class UpdateRecipeDto extends PartialType(CreateRecipeDto)
{

}

/* 
La funzione PartialType(CreateRecipeDto) fa due cose in         
  automatico:
  
  1. Rende opzionali tutti i campi: Prende tutte le proprietà di  
  CreateRecipeDto e vi applica l'equivalente del punto            
  interrogativo di TypeScript (title?: string, description?:      
  string, ecc.).
  2. Mantiene e adatta i validatori: Eredita tutti i decoratori di
  class-validator (come @IsString(), @IsEnum(), ecc.)             
  aggiungendovi automaticamente @IsOptional(). In questo modo:    
      • Se il client non invia un campo, non ci saranno errori di 
      validazione (es. non richiederà @IsNotEmpty()).             
      • Se il client invia quel campo per aggiornarlo, il campo   
      verrà comunque validato con le stesse regole definite in    
      CreateRecipeDto.

*/