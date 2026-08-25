    import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
 	import { PrismaClient } from '@prisma/client';
    import { PrismaPg } from '@prisma/adapter-pg';

    @Injectable()
    export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
      constructor() {
        // Inizializza l'adattatore PostgreSQL usando la variabile d'ambiente del container                            
        const adapter = new PrismaPg({
          connectionString: process.env.DATABASE_URL,
        });

        super({ adapter });                                                                                            
      }

      // Si connette al DB quando il modulo si avvia                                                                   
      async onModuleInit() {                                                                                           
        await this.$connect();                                                                                         
      }                                                                                                                
                                                                                                                       
      // Chiude la connessione quando l'applicazione si spegne                                                         
      async onModuleDestroy() {
        await this.$disconnect();
      }
    }