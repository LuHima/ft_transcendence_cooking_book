
import { Injectable, CanActivate, ExecutionContext} from '@nestjs/common';
import { CaslAbilityFactory, AppAbility } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
import { ActiveUserData } from '../decorators/current-user.decorator';
import { Reflector } from '@nestjs/core';
import { createHttpException, errors } from '../config/error.config';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private casl: CaslAbilityFactory, private reflector: Reflector) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		let user: ActiveUserData  = request.user || null;
		if (!user)
			throw createHttpException(errors.auth.accessDenied);
		let userAbility = this.casl.createForUser(user) as AppAbility;
		const data = this.reflector.get('action', context.getHandler());

		if (!data) { // se non ci sono regole faccio passare tutto
  			return true; 
		}
		request['casl'] = {
			action: data.action,
			subject: data.subject,
		}
		return userAbility.can(data.action, data.subject);
	}
}
