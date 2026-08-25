import { OwnerType } from "@prisma/client";
import { /* isEmail, */IsEnum, IsNumber, IsNotEmpty, IsString} from "class-validator";


export class CreateRecipeDto
{

  @IsNotEmpty()
  @IsString()
  title: string;
  
  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsString()
  instructions: string;

  @IsNumber()
  @IsNotEmpty()
  prep_time: number;

  @IsNumber()
  @IsNotEmpty()
  user_id: number;

  @IsNotEmpty()
  @IsEnum(["user","platform"], {
    message: 'Valid owner required'
  })
  owner_type: OwnerType;
}