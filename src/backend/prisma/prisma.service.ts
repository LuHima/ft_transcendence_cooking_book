import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    // Initialize the PostgreSQL adapter from the container's environment variable
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });

    super({ adapter });
  }

  // Connect to the database when the module starts
  async onModuleInit() {
    await this.$connect();
  }

  // Close the connection when the application shuts down
  async onModuleDestroy() {
    await this.$disconnect();
  }
}