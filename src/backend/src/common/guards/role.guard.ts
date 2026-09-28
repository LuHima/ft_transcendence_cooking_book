
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { CaslAbilityFactory, AppAbility } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
import { ActiveUserData } from '../decorators/current-user.decorator';
import { HandlerRolePolicy } from '../decorators/policies.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private casl: CaslAbilityFactory) {}

	private execPolicyHandler(handler: HandlerRolePolicy, ability: AppAbility) {
	if (typeof handler === 'function') {
		return handler(ability);
	}
		return handler.handle(ability);
  	}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		let user: ActiveUserData  = request.user || null;
		if (user === null)
			return false;
		let userAbility = this.casl.createForUser(user) as AppAbility;
		return true;
	}
}
