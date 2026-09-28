import { SetMetadata } from '@nestjs/common';
import { AppAbility } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
// import {e}
export type PolicyHandlerCallback = (ability: AppAbility) =>  boolean;







