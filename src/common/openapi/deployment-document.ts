import type { OpenAPIObject, ResponseObject } from '@nestjs/swagger';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

/** Deployment documentation only; does not modify the approved target contract. */
export function deploymentDocument(): OpenAPIObject {
  const document = load(
    readFileSync('./Docs/Contracts/platform-api.v1.yaml', 'utf8'),
  ) as OpenAPIObject;
  document.servers = [{ url: '/' }];
  document.info.title = 'Platform API - alcance disponible';
  document.info.description =
    'Documentacion de la implementacion actual. Auth, Users, Tenants, Campaigns, ' +
    'Prospects persistidos y Health estan disponibles. Jobs permite consultar registros ' +
    'existentes; inicio, cancelacion, persistencia y exportacion no estan disponibles. ' +
    'El contrato objetivo V1 se conserva en Docs/Contracts/platform-api.v1.yaml. ' +
    'Prospector Service, sus callbacks y politicas operacionales siguen pendientes.';

  const unavailable: ResponseObject = {
    description:
      'Integracion de prospeccion pendiente. No escribe datos ni genera archivos.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
        example: {
          success: false,
          error: {
            code: 'HTTP_503',
            message: 'Internal server error',
            details: { reason: 'PROSPECTOR_INTEGRATION_PENDING' },
            timestamp: '2026-09-27T00:00:00.000Z',
          },
        },
      },
    },
  };
  const forbidden: ResponseObject = {
    description: 'Permisos insuficientes o tenant no seleccionado.',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
      },
    },
  };
  const operations = [
    ['/api/v1/prospecting-jobs', 'post'],
    ['/api/v1/prospecting-jobs/{id}/cancel', 'post'],
    ['/api/v1/prospecting-jobs/{id}/persist', 'post'],
    ['/api/v1/prospecting-jobs/{id}/export', 'get'],
  ] as const;
  for (const [path, method] of operations) {
    const operation = document.paths[path]?.[method];
    if (!operation)
      throw new Error(`Missing baseline operation: ${method} ${path}`);
    operation.summary = `No disponible: ${operation.summary ?? operation.operationId}`;
    operation.description =
      'Ruta conservada y protegida. Tras autenticar y validar la solicitud devuelve 503 ' +
      'con error.details.reason=PROSPECTOR_INTEGRATION_PENDING. No ejecuta scraping, ' +
      'no guarda resultados ni devuelve archivos. Idempotency-Key sigue siendo obligatorio ' +
      'al crear, pero no se almacena ni se implementa idempotencia persistente.';
    operation.responses = {
      '400': { $ref: '#/components/responses/BadRequest' },
      '401': { $ref: '#/components/responses/Unauthorized' },
      '403': forbidden,
      '503': unavailable,
    };
  }
  const list = document.paths['/api/v1/prospecting-jobs'].get!;
  list.description =
    'Consulta registros existentes del tenant seleccionado. No inicia ejecuciones.';
  list.responses['403'] = forbidden;
  list.responses['400'] = { $ref: '#/components/responses/BadRequest' };
  list.parameters = list.parameters?.map((parameter) =>
    '$ref' in parameter && parameter.$ref === '#/components/parameters/SortBy'
      ? {
          name: 'sortBy',
          in: 'query',
          schema: {
            type: 'string',
            default: 'createdAt',
            enum: [
              'createdAt',
              'updatedAt',
              'startedAt',
              'completedAt',
              'status',
              'id',
            ],
          },
        }
      : parameter,
  );
  const detail = document.paths['/api/v1/prospecting-jobs/{id}'].get!;
  detail.description =
    'Consulta el registro persistido. resultsAvailable=false, results=null y progress=null, incluso si el estado guardado es COMPLETED.';
  detail.responses['403'] = forbidden;
  const success = detail.responses['200'];
  if (success && !('$ref' in success))
    success.description =
      'Registro persistido, sin resultados ni progreso temporal.';
  return document;
}
