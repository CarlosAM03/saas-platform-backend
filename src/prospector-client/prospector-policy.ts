import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ProspectorSettings {
  serviceOrigin: string;
  callbackOrigin: string;
  serviceKey: string;
  callbackKey: string;
  generation: string;
  timeoutMs: number;
  jobTimeoutSeconds: number;
  maxActive: number;
  tenantJobs: number;
  globalJobs: number;
  periodSeconds: number;
  maxResultBytes: number;
  maxTotalResultBytes: number;
  resultsTtlSeconds: number;
}

export const unavailable = (
  reason = 'PROSPECTOR_INTEGRATION_PENDING',
  jobId?: string,
) =>
  new ServiceUnavailableException({
    message: 'Prospecting is unavailable',
    details: { reason, ...(jobId ? { jobId } : {}) },
  });

@Injectable()
export class ProspectorPolicy {
  constructor(private readonly config: ConfigService) {}

  inspect(): {
    enabled: boolean;
    settings: ProspectorSettings | null;
    reason: string | null;
  } {
    const enabled = this.config.get<unknown>('PROSPECTOR_ENABLED') === 'true';
    try {
      const text = (name: string) => {
        const value = this.config.get<unknown>(name);
        if (
          typeof value !== 'string' ||
          !value.trim() ||
          value !== value.trim()
        )
          throw new Error('configuration');
        return value;
      };
      const integer = (name: string, min: number, max: number) => {
        const value = text(name);
        const number = Number(value);
        if (
          !/^\d+$/.test(value) ||
          !Number.isSafeInteger(number) ||
          number < min ||
          number > max
        )
          throw new Error('configuration');
        return number;
      };
      const origin = (name: string) => {
        const value = text(name);
        const parsed = new URL(value);
        const local = ['localhost', '127.0.0.1', '[::1]'].includes(
          parsed.hostname,
        );
        const allowLocal =
          this.config.get<string>('PROSPECTOR_ALLOW_LOCAL_HTTP') === 'true' &&
          ['test', 'development'].includes(
            this.config.get<string>('NODE_ENV') ?? '',
          );
        if (
          !['http:', 'https:'].includes(parsed.protocol) ||
          parsed.username ||
          parsed.password ||
          !['', '/'].includes(parsed.pathname) ||
          parsed.search ||
          parsed.hash ||
          /[\s\\%]/.test(value) ||
          (parsed.protocol !== 'https:' && !(local && allowLocal)) ||
          (local && !allowLocal)
        )
          throw new Error('configuration');
        return parsed.origin;
      };
      if (text('PROSPECTOR_BUDGET_APPROVED') !== 'true')
        throw new Error('configuration');
      const serviceKey = text('PROSPECTOR_SERVICE_API_KEY');
      const callbackKey =
        this.config.get<string>('PROSPECTOR_CALLBACK_API_KEY') ??
        this.config.get<string>('PROSPECTOR_API_KEY') ??
        '';
      const generation = text('PROSPECTOR_SERVICE_GENERATION');
      if (
        serviceKey.length < 32 ||
        callbackKey.length < 32 ||
        callbackKey !== callbackKey.trim() ||
        !/^[A-Za-z0-9._-]{1,64}$/.test(generation)
      )
        throw new Error('configuration');
      const settings: ProspectorSettings = {
        serviceOrigin: origin('PROSPECTOR_SERVICE_URL'),
        callbackOrigin: origin('PROSPECTOR_CALLBACK_ORIGIN'),
        serviceKey,
        callbackKey,
        generation,
        timeoutMs: integer('PROSPECTOR_HTTP_TIMEOUT_MS', 100, 60000),
        jobTimeoutSeconds: integer(
          'PROSPECTOR_JOB_TIMEOUT_SECONDS',
          300,
          86400,
        ),
        maxActive: integer('PROSPECTOR_MAX_ACTIVE_JOBS', 1, 17),
        tenantJobs: integer('PROSPECTOR_TENANT_JOBS_PER_PERIOD', 1, 100),
        globalJobs: integer('PROSPECTOR_GLOBAL_JOBS_PER_PERIOD', 1, 100),
        periodSeconds: integer('PROSPECTOR_QUOTA_PERIOD_SECONDS', 60, 2678400),
        maxResultBytes: integer('PROSPECTOR_MAX_RESULT_BYTES', 1024, 1048576),
        maxTotalResultBytes: integer(
          'PROSPECTOR_MAX_TOTAL_RESULT_BYTES',
          1024,
          104857600,
        ),
        resultsTtlSeconds: 3600,
      };
      if (
        settings.tenantJobs > settings.globalJobs ||
        settings.maxTotalResultBytes < settings.maxResultBytes
      )
        throw new Error('configuration');
      return {
        enabled,
        settings,
        reason: enabled ? null : 'PROSPECTOR_INTEGRATION_PENDING',
      };
    } catch {
      return {
        enabled,
        settings: null,
        reason: enabled
          ? 'PROSPECTOR_POLICY_NOT_CONFIGURED'
          : 'PROSPECTOR_INTEGRATION_PENDING',
      };
    }
  }

  requireEnabled(): ProspectorSettings {
    const policy = this.inspect();
    if (!policy.enabled || !policy.settings)
      throw unavailable(policy.reason ?? undefined);
    return policy.settings;
  }

  requireConfigured(): ProspectorSettings {
    const policy = this.inspect();
    if (!policy.settings) throw unavailable(policy.reason ?? undefined);
    return policy.settings;
  }
}
