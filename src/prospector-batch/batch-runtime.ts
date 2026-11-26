import { timingSafeEqual } from 'node:crypto';
import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BatchTransport } from './batch-transport';

@Injectable()
export class BatchRuntime {
  constructor(private readonly config: ConfigService) {}

  connect(): { transport: BatchTransport; solutionId: string } {
    this.assertEnabled();
    const solutionId = this.value('PROSPECTOR_BATCH_SOLUTION_ID');
    const apiKey = this.value('PROSPECTOR_BATCH_API_KEY');
    const assertionKey = this.value('PROSPECTOR_BATCH_ASSERTION_KEY');
    const callbackKey = this.value('PROSPECTOR_BATCH_CALLBACK_KEY');
    if (
      new Set([
        apiKey,
        assertionKey,
        callbackKey,
        this.config.get('JWT_SECRET'),
      ]).size !== 4 ||
      Buffer.byteLength(callbackKey) < 32
    ) {
      throw this.unavailable();
    }
    try {
      const transport = new BatchTransport({
        solutionId,
        apiKey,
        assertionKey,
        issuer: this.value('PROSPECTOR_BATCH_ASSERTION_ISSUER'),
        audience:
          this.config.get<string>('PROSPECTOR_BATCH_ASSERTION_AUDIENCE') ??
          'prospector-service/v1',
        origin: this.value('PROSPECTOR_BATCH_SERVICE_ORIGIN'),
        timeoutMs: Number(
          this.config.get('PROSPECTOR_BATCH_TIMEOUT_MS') ?? '10000',
        ),
      });
      return { transport, solutionId };
    } catch {
      throw this.unavailable();
    }
  }

  authorizeCallback(supplied: string | undefined): string {
    const { solutionId } = this.connect();
    const expected = Buffer.from(this.value('PROSPECTOR_BATCH_CALLBACK_KEY'));
    const presented = Buffer.from(supplied ?? '');
    if (
      expected.length !== presented.length ||
      !timingSafeEqual(expected, presented)
    ) {
      throw new UnauthorizedException('Invalid callback credentials');
    }
    return solutionId;
  }

  private assertEnabled(): void {
    if (this.config.get<string>('PROSPECTOR_BATCH_ENABLED') !== 'true') {
      throw this.unavailable();
    }
  }

  private value(key: string): string {
    const value = this.config.get<string>(key);
    if (!value || value !== value.trim()) throw this.unavailable();
    return value;
  }

  private unavailable(): ServiceUnavailableException {
    return new ServiceUnavailableException('Batch integration unavailable');
  }
}
