import { PrismaService } from "prisma/prisma.service";
import { CaslAbilityFactory } from './casl-ability.factory/casl-ability.factory';
import { Injectable, Inject, Scope} from '@nestjs/common';
import { Action } from './action.enum';
import { Subjects } from "./casl-ability.factory/casl-ability.factory";
import { subject } from '@casl/ability';
import { REQUEST } from '@nestjs/core';
import { ActiveUserData } from "src/common/decorators/current-user.decorator";
import { createHttpException, errors } from "src/common/config/error.config";
import type { Request } from 'express';


export interface CaslActionData {
	action: Action;
	subject: string;
}


@Injectable({scope: Scope.REQUEST}) // {scope: Scope.REQUEST} serve perche all'avvio nest con inject la instanzia una sola volta per tutti quindi ogni utilizzo avra la
export class CaslCheckAbility		// la stessa richiesta http Che non esiste all'avvio, quindi esisterebbe 1 sola istanza di questa classe indipendentemete dalle chiamate che è un problema
{									// Quindi scrivere {scope: Scope.REQUEST} ti dice non crearla all'avvio questa classe creamelo a ogni chiamata http 
									// 	e distruggila una volta inviata la risposta quindi per ogni utente ce una istanza diversa con http diversi
									
	constructor(private readonly prisma: PrismaService,private readonly caslFactory: CaslAbilityFactory, @Inject(REQUEST) private req: Request) {}
	// nel costruttore poi inietto la richiesta http in maniera da leggere il payload
	async canAbility(idTarget: number): Promise<boolean>
	{
		const casl = this.req['casl'] as CaslActionData | undefined;
		const user = this.req['user'] as ActiveUserData | undefined;

		if (!casl || !user)
			throw createHttpException(errors.common.unauthorized);
		let target:any = null;
		if(casl.subject === 'User')
			target = await this.prisma.user.findUnique({ where: { id: idTarget } });
		else if(casl.subject === 'Recipe')
			target = await this.prisma.recipe.findUnique({ where: { id: idTarget }, include: { user: { select: { id: true, role: true } } }});
		else if(casl.subject === 'Comment')
			target = await this.prisma.comment.findUnique({ where: { id: idTarget }, include: { user: { select: { id: true, role: true } }}});
		/* 
		include: include anche la tabella anidata come oggetto
		dico a prisma quanto passa l'oggetto (ricetta per esempio) passa anche le sue tabelle anidata quindi anche user
		ricetta = {
			id: 1,
			...il resto
			user: {
				tutte le (io ci ho messo una select per diminurire la roba)
			}
		}
		*/

		 if (!target)
			throw createHttpException(errors.common.notFound)

		const ability = this.caslFactory.createForUser(user);

		// subject(casl.subject, target) aggiugo un target che è praticamente la mia tabella utente per vedere nel can se puo fare quella azione 
		return ability.can(casl.action, subject(casl.subject, target));

	}

}