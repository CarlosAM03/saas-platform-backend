import { Module } from '@nestjs/common';
import { ProspectorPolicy } from './prospector-policy';
import { ProspectorClientService } from './prospector-client.service';

@Module({
  providers: [ProspectorClientService, ProspectorPolicy],
  exports: [ProspectorClientService, ProspectorPolicy],
})
export class ProspectorClientModule {}
