
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { CaslAbilityFactory, AppAbility } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';

@Injectable()
export class RolesGuard implements CanActivate {
	constructor(private casl: CaslAbilityFactory) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest();
		let role: string  = request.user?.role;
		return true;
	}
}
