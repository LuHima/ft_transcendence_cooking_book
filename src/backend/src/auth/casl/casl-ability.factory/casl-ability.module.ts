import { Module, Global } from '@nestjs/common';
import { CaslAbilityFactory } from './casl-ability.factory';
import { CaslCheckAbility } from '../casl-checkAbility';

@Global()
@Module({
	providers: [CaslAbilityFactory, CaslAbilityFactory],
	exports: [CaslAbilityFactory, CaslAbilityFactory],
})
export class CaslModule {

  
}
