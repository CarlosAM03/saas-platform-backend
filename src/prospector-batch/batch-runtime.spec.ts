import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BatchRuntime } from './batch-runtime';

describe('private batch feature gate', () => {
  it.each(['false', 'TRUE', ''])(
    'rejects flag %p before accessing the service',
    (flag) => {
      const config = new ConfigService({ PROSPECTOR_BATCH_ENABLED: flag });
      expect(() => new BatchRuntime(config).connect()).toThrow(
        ServiceUnavailableException,
      );
    },
  );
});
