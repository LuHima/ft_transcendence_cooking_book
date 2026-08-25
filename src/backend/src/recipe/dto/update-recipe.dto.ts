import { CreateRecipeDto } from "./create-recipe.dto";
import {PartialType} from "@nestjs/mapped-types"

export class UpdateRecipeDto extends PartialType(CreateRecipeDto)
{

}