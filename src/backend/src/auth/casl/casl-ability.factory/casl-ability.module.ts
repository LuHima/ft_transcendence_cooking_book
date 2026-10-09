import { Module, Global } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslCheckAbility } from '../casl-checkAbility';

@Global()
@Module({
  providers: [CaslAbilityFactory, CaslCheckAbility],
  exports: [CaslAbilityFactory, CaslCheckAbility],
})
export class CaslModule {}
