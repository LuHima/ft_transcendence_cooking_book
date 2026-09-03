import { OwnerType } from "@prisma/client";
import { MinLength, MaxLength, IsEnum, IsNumber, IsNotEmpty, IsString} from "class-validator";


export class CreateRecipeDto
{

  @IsNotEmpty()
  @IsString()
  @MinLength(3, {message: 'The Recipe must be at least 3 characters long'})
  @MaxLength(30, {message: 'The Recipe cannot exceed 30 characters'})
  title: string;
  
  @IsNotEmpty()
  @IsString()
  @MinLength(25, {message: 'The description must be at least 25 characters long'})
  @MaxLength(5000, {message: 'The description cannot exceed 5000 characters'})
  description: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(50, {message: 'The instruction must be at least 50 characters long'})
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