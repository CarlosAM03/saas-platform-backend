import type { OpenAPIObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

export const registrationPaths = [
  '/api/v1/tenants/register',
  '/api/v1/tenants/{id}/onboarding',
  '/api/v1/tenants/{id}/resend-welcome',
  '/api/v1/auth/redeem-first-access',
  '/api/v1/auth/complete-first-access',
] as const;

/** Controlled composition: only the five approved operations and new schemas.
 * Never replace existing core paths, login response, or shared schemas. */
export function addTenantRegistration(
  document: OpenAPIObject,
  enabled: boolean,
): void {
  const approved = load(
    readFileSync(
      './Docs/Contracts/platform-api.tenant-registration.approved.yaml',
      'utf8',
    ),
  ) as OpenAPIObject;
  for (const path of registrationPaths) {
    if (document.paths[path])
      throw new Error('Duplicate registration operation');
    const item = structuredClone(approved.paths[path]);
    document.paths[path] = item;
    for (const method of ['get', 'post'] as const) {
      const operation = item[method];
      if (!operation) continue;
      delete (operation as unknown as Record<string, unknown>)[
        'x-implementation-status'
      ];
      operation.summary = operation.summary?.replace(
        /\s*\(futuro; no implementado\)/,
        '',
      );
      operation.description = `${operation.description ?? ''}\nImplementación local ADR-006. No acredita habilitación productiva.`;
      const gated =
        path.endsWith('/register') || path.endsWith('/resend-welcome');
      if (gated && !enabled) {
        operation.summary = `Desactivado por configuración: ${operation.summary}`;
        operation.description +=
          '\nTENANT_REGISTRATION_ENABLED=false: tras autenticación y validación, responde 503 sin escrituras.';
        delete operation.responses[path.endsWith('/register') ? '201' : '200'];
      }
    }
  }
  document.components ??= {};
  document.components.schemas ??= {};
  for (const [name, schema] of Object.entries(
    approved.components?.schemas ?? {},
  )) {
    if (!document.components.schemas[name])
      document.components.schemas[name] = structuredClone(schema);
  }
  document.info.version = '1.1.0';
  document.info.description +=
    '\nADR-006: activación por enlace y desafío sin sesión automática. Nuevas altas/reenvíos desactivados por defecto; consulta y activación de pendientes disponibles.';
}
