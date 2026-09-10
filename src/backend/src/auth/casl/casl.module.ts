import { Module } from '@nestjs/common';
import { CaslModule } from './casl-ability.factory/casl-ability.module';

@Module({
  imports: [CaslModule]
})
export class CaslModule {}
