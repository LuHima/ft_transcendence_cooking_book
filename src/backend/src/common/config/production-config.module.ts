import { Global, Module } from '@nestjs/common';
import { ProductionConfig } from './production.config';

@Global()
@Module({
  providers: [ProductionConfig],
  exports: [ProductionConfig],
})
export class ProductionConfigModule {}
