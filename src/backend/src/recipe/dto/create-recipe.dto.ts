import { OwnerType } from "@prisma/client";

export class CreateRecipeDto
{

  title: string;
  
  description: string;

  instructions: string;

  prep_time: number;

  user_id: number;

  owner_type: OwnerType;
}