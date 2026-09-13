import { PrismaClient } from "@prisma/client";
import { Action } from "../action.enum";
import { AbilityBuilder, MongoAbility, createMongoAbility, InferSubjects, ForcedSubject  } from '@casl/ability'; //MongoAbility non centra niente con MongoDB
import { AuthGuard } from "src/common/guards/auth.guard";
import { UseGuards, Injectable } from "@nestjs/common";
import { CurrentUser, ActiveUserData } from "src/common/decorators/current-user.decorator";
import { Recipe, Comment, User, Role } from "@prisma/client";

    // Definisce i soggetti (come stringhe per Prisma, o 'all')     
    export type Subjects = InferSubjects<Recipe & ForcedSubject<'Recipe'>> | InferSubjects<Comment & ForcedSubject<'Comment'>> | InferSubjects<User & ForcedSubject<'User'>> | 'all';      

    // Definisce il tipo AppAbility con MongoAbility
    export type AppAbility = MongoAbility<[Action, Subjects]>;         
/* 
1. Action: Cosa puoi fare (es. Read, Update, Delete).
2. Subject: Su cosa puoi farlo (es. una ricetta, un commento, un utente).                                                         
*/
@Injectable()
//@UseGuards(AuthGuard)
export class CaslAbilityFactory {
  
  createForUser(user: ActiveUserData) {
    const { can, cannot, build } = new AbilityBuilder<AppAbility>(createMongoAbility);

    if (user.role ===  Role.admin) {
      can(Action.Manage, 'all'); // read-write access to everything
    } 
    else {
      can(Action.Read, 'all'); // read-only access to everything
      can(Action.Create, 'Recipe');                                
      // Può modificare o cancellare solo le ricette create da lui 
      can(Action.Update, 'Recipe', { user_id: user.id });          
      can(Action.Delete, 'Recipe', { user_id: user.id });
      can(Action.Report, 'Recipe')
      can(Action.Report, 'Comment')

      // i cannot non sono necessari perche tutto cio che non e' permesso e' bloccato
      cannot(Action.Manage, 'all')
      cannot(Action.Ban, 'Recipe')
      cannot(Action.Ban, 'Comment')
      cannot(Action.Ban, 'User')
    }
    return build();
  }
}

/*
build:

un console.log(ability), si vedrebbe che l'oggetto contiene: 
                                                                       
  1. L'elenco interno delle regole compilate (rules):                  
  Un array di tutte le regole calcolate per quell'utente:              
    [                                                                  
      { "action": "read", "subject": "all" },                          
      { "action": "create", "subject": "Recipe" },                     
      { "action": "update", "subject": "Recipe", "conditions": {       
  "user_id": 1 } },                                                    
      { "action": "delete", "subject": "Recipe", "conditions": {       
  "user_id": 1 } }                                                     
    ]               

*/