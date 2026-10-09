import { applyDecorators, SetMetadata, UseGuards, ExecutionContext } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AppAbility } from 'src/auth/casl/casl-ability.factory/casl-ability.factory';
import { Action } from 'src/auth/casl/action.enum';
import { AuthGuard } from 'src/common/guards/auth.guard';
import { RolesGuard } from '../guards/role.guard';
import { Subjects } from '../../auth/casl/casl-ability.factory/casl-ability.factory';
import { ApiErrorResponseDto } from '../dto/api-error-response.dto';

export type HandlerRolePolicy = (ability: AppAbility) =>  boolean;

/**
 * Composite authentication and authorization decorator.
 * Enforces JWT accessToken cookie authentication and optional CASL action/subject policy checks.
 * Also attaches OpenAPI security scheme metadata and error response specifications.
 */
export function Auth(...args: [action: Action, subject: Subjects] | []){
	const action = args[0];
	const subject = args[1];

	if (action && subject) {
		return applyDecorators(
			SetMetadata('action',{ action, subject }),
			UseGuards(AuthGuard, RolesGuard),
			ApiCookieAuth('accessToken'),
			ApiUnauthorizedResponse({
				description: 'Authentication required: missing or invalid accessToken cookie',
				type: ApiErrorResponseDto,
			}),
			ApiForbiddenResponse({
				description: 'Forbidden: insufficient permissions for this action on the target resource',
				type: ApiErrorResponseDto,
			}),
		);
	}

	return applyDecorators(
		UseGuards(AuthGuard),
		ApiCookieAuth('accessToken'),
		ApiUnauthorizedResponse({
			description: 'Authentication required: missing or invalid accessToken cookie',
			type: ApiErrorResponseDto,
		}),
	);
};

/*
setMetadata
 --------------------------------------------------------------------------------------------
								Cos'è
--------------------------------------------------------------------------------------------
è un wrapper dell funzione reflect che al posto di scrivere cosi:
	
	target = la classe o il prototipo
	propertyKey = il nome del metodo ('createRecipe')
	Reflect.defineMetadata('action', { action, subject }, target, propertyKey);

	si scrive 

	SetMetadata('action', { action, subject })
--------------------------------------------------------------------------------------------
								cos fa
--------------------------------------------------------------------------------------------
salva in una tabella di memoria interna della libreria reflect-metadata che usa un libreria (weakMap che è importata nel main)
che associa il refirmento della funzione che la chiama alla chiave metadata che in questo caso è 'action' dei valori 
[Riferimento in memoria della Funzione] 
		└── Chiave del metadato ('action') 
				└── Il Valore ({ action: Action.Create, subject: 'Recipe' })
una volta finito il suo lavoro la mappa weakMap viene rimossa dalla memoria

--------------------------------------------------------------------------------------------
						come si ottiene il valore
--------------------------------------------------------------------------------------------
creando un oggetto reflector 

NestJS ti mette a disposizione la classe Reflector, che è un servizio iniettabile nei Guard,
negli Interceptor o nei Middleware.

const data = this.reflector.get('action', targetFunction);
*/





