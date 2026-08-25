<<<<<<< HEAD
import { OwnerType } from "@prisma/client";

=======
>>>>>>> c671b6e7bd3ec97acbb6bb6039e1b4a9a9b2b1a9
export class CreateRecipeDto
{

  title: string;
  
  description: string;

  instructions: string;

  prep_time: number;

  user_id: number;

  owner_type: OwnerType;
}