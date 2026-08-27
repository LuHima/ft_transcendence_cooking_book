import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from '../prisma/prisma.module';



// SI IMPORTA IL FILE SPECIFICANDO IL PERCORSO QUI IN CIMA (non si mette .ts alla fine)
// import { nome della classe nel file scelto } from './percorso del file';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RecipeModule } from './recipe/recipe.module';


@Module({
  // NELL'ARRAY SI METTE SOLO IL NOME DELLA CLASSE, NON LA STRINGA DEL PERCORSO!
  imports: [PrismaModule, AuthModule, UsersModule, RecipeModule], // gli import degli altri module creati
  controllers: [AppController], //qui ci vanno i file controller
  providers: [AppService], //qui ci vanno i file service 
})
export class AppModule {}
