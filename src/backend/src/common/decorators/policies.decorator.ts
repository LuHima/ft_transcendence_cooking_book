import { SetMetadata } from '@nestjs/common';                      
import { AppAbility } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';

export type PolicyHandlerCallback = (ability: AppAbility) =>  boolean;







