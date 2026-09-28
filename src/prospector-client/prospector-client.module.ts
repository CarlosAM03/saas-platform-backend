import { Module } from '@nestjs/common';
import { ProspectorClientService } from './prospector-client.service';

@Module({
  providers: [ProspectorClientService],
  exports: [ProspectorClientService],
})
export class ProspectorClientModule {}
