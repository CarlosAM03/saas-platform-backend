import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ProspectorClientService } from './prospector-client.service';

@Module({
  imports: [ConfigModule],
  providers: [ProspectorClientService],
  exports: [ProspectorClientService],
})
export class ProspectorClientModule {}
