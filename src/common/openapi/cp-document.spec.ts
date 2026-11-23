import Ajv from 'ajv';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { load } from 'js-yaml';
import { BadRequestException, Module, ValidationPipe } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import type {
  OpenAPIObject,
  ParameterObject,
  SchemaObject,
} from '@nestjs/swagger';
import { ResolveProspectRequest } from '../../prospects/dto/resolve-prospect.request';
import { CampaignProspectsQuery } from '../../campaigns/dto/campaign-prospects.query';
import { ProspectHistoryQuery } from '../../prospects/dto/prospect-history.query';
import { UpdateProspectRequest } from '../../prospects/dto/update-prospect.request';
import { deploymentDocument } from './deployment-document';

const baseline = () =>
  load(
    readFileSync('./Docs/Contracts/platform-api.v1.yaml', 'utf8'),
  ) as OpenAPIObject;

@Module({})
class IsolatedDocsModule {}

describe('CP contract schemas and documented capabilities', () => {
  const document = baseline();
  // AJV 6 is already present transitively. No dependency or lockfile change.
  // Nullable is an OpenAPI 3.0 extension, not a JSON Schema keyword by default.
  const ajv = new Ajv({ allErrors: true, nullable: true });
  const acceptsResolve = ajv.compile({
    components: document.components,
    $ref: '#/components/schemas/ResolveProspectRequest',
  });
  const required = {
    campaignId: 'campaign-synthetic',
    name: 'Prospecto sintetico',
  };

  it.each([
    { ...required, resolution: 'CREATE' },
    { ...required, resolution: 'SKIP' },
    {
      ...required,
      resolution: 'LINK_EXISTING',
      candidateId: 'prospect-synthetic',
    },
    {
      ...required,
      resolution: 'CREATE',
      category: null,
      address: null,
      phone: '0012345',
      email: 'synthetic@example.test',
      website: 'https://example.test',
      language: 'es',
      status: 'INACTIVO',
      metadata: { synthetic: true },
      identitySource: 'google_maps',
      identityIdentifier: 'synthetic-external-id',
    },
  ])('accepts the same valid resolve request as the DTO: %j', (body) => {
    expect(acceptsResolve(body)).toBe(true);
    expect(
      validateSync(plainToInstance(ResolveProspectRequest, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toEqual([]);
  });

  it.each([
    { ...required },
    { name: required.name, resolution: 'SKIP' },
    { campaignId: required.campaignId, resolution: 'SKIP' },
    { ...required, resolution: 'MERGE' },
    { ...required, resolution: 'SKIP', campaignId: 'with spaces' },
    { ...required, resolution: 'CREATE', name: '   ' },
    { ...required, resolution: 'CREATE', status: 'APTO' },
    { ...required, resolution: 'CREATE', candidateId: '   ' },
    { ...required, resolution: 'CREATE', candidateId: 'x'.repeat(129) },
    { ...required, resolution: 'CREATE', identitySource: 'untrusted' },
    { ...required, resolution: 'CREATE', identityIdentifier: '   ' },
    {
      ...required,
      resolution: 'CREATE',
      identityIdentifier: 'x'.repeat(513),
    },
    { ...required, resolution: 'CREATE', tenantId: 'client-controlled' },
    { ...required, resolution: 'CREATE', recordedAt: 'client-controlled' },
  ])('rejects the same invalid resolve request as the DTO: %j', (body) => {
    expect(acceptsResolve(body)).toBe(false);
    expect(
      validateSync(plainToInstance(ResolveProspectRequest, body), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }).length,
    ).toBeGreaterThan(0);
  });

  it('keeps the resolve object closed while preserving inherited fields', () => {
    const schemas = document.components!.schemas!;
    const create = schemas.CreateProspectRequest as SchemaObject;
    const resolve = schemas.ResolveProspectRequest as SchemaObject;
    expect(resolve.additionalProperties).toBe(false);
    expect(resolve.allOf).toBeUndefined();
    expect(resolve.required).toEqual(['campaignId', 'name', 'resolution']);
    for (const [field, schema] of Object.entries(create.properties!)) {
      const constraints = { ...(schema as SchemaObject) };
      delete constraints.description;
      expect(resolve.properties![field]).toEqual(constraints);
    }
    expect(Object.keys(resolve.properties!)).toHaveLength(
      Object.keys(create.properties!).length + 2,
    );
  });

  it('documents create/reuse and conflict without changing its response shape', () => {
    const operation = document.paths['/api/v1/prospects'].post!;
    expect(operation.responses['409']).toEqual({
      $ref: '#/components/responses/Conflict',
    });
    expect(operation.description).toContain('reutiliza');
    expect(operation.description).toContain('/api/v1/prospects/match');
    expect(operation.description).toContain('/api/v1/prospects/resolve');
    expect(operation.responses['201']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: '#/components/schemas/SuccessResponse' },
              {
                type: 'object',
                properties: {
                  data: { $ref: '#/components/schemas/Prospect' },
                },
              },
            ],
          },
        },
      },
    });
  });

  it.each([
    '/api/v1/campaigns/{id}/prospects',
    '/api/v1/campaigns/{campaignId}/prospects/{prospectId}/activities',
  ])('documents query validation, roles and stable order for %s', (path) => {
    const operation = document.paths[path].get!;
    expect(operation.description).toContain('ADMIN, OWNER y MEMBER');
    expect(operation.description).toContain('tenant seleccionado');
    expect(operation.responses['400']).toBeDefined();
    expect(operation.responses['403']).toBeDefined();
    const sort = operation.parameters!.find(
      (p) => !('$ref' in p) && p.name === 'sortBy',
    ) as ParameterObject;
    expect(sort.schema).toEqual({
      type: 'string',
      enum: ['name', 'email', 'status', 'createdAt', 'updatedAt'],
      default: 'name',
    });
    expect(document.components!.parameters!.Page).toMatchObject({
      schema: { minimum: 1, default: 1 },
    });
    expect(document.components!.parameters!.Limit).toMatchObject({
      schema: { minimum: 1, maximum: 100, default: 20 },
    });
    expect(document.components!.parameters!.SortOrder).toMatchObject({
      schema: { enum: ['asc', 'desc'], default: 'asc' },
    });
  });

  it.each(['preview', 'confirm'])(
    'documents the CSV %s 413 wrapper',
    (action) => {
      expect(
        document.paths[`/api/v1/prospects/import/${action}`].post!.responses[
          '413'
        ],
      ).toMatchObject({
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      });
    },
  );

  it('documents explicit CREATE for a single weak match, not candidate selection', () => {
    const operation = document.paths['/api/v1/prospects/import/confirm'].post!;
    expect(operation.description).toContain(
      'MATCH con un único candidato débil admite CREATE',
    );
    expect(operation.description).toContain(
      'INVALID y CONFLICT siguen REJECTED, sin candidateId',
    );
    expect(operation.description).toContain('dentro de la transacción');
  });

  it('preserves complete CP paths in deploymentDocument without HTTP or DB', () => {
    const cp = (doc: OpenAPIObject) =>
      Object.fromEntries(
        Object.entries(doc.paths).filter(([path]) =>
          /^\/api\/v1\/(campaigns|prospects)(\/|$)/.test(path),
        ),
      );
    expect(cp(deploymentDocument())).toEqual(cp(document));
  });

  const errors = (dto: object) =>
    validateSync(dto, { whitelist: true, forbidNonWhitelisted: true });

  it.each([
    { addedFrom: '2026-11-22T00:00Z' },
    { addedFrom: '2026-11-22T00:00:00Z', addedTo: '2026-11-22T00:00:00Z' },
    { activityFrom: '2026-11-22T00:00:00-08:00' },
    { activityTo: '2026-11-22T00:00:00+05:30' },
    {
      addedFrom: '2026-11-22T00:00:00Z',
      addedTo: '2026-11-23T00:00:00Z',
      activityFrom: '2026-11-22T00:00:00Z',
      activityTo: '2026-11-23T00:00:00Z',
      stage: 'CONTACTADO',
      evaluation: 'APTO',
      responsibleId: 'UNASSIGNED',
      page: '1',
      limit: '100',
    },
  ])('accepts inclusive timezone ranges and AND dimensions: %j', (query) => {
    expect(errors(plainToInstance(CampaignProspectsQuery, query))).toEqual([]);
    const timestamp = ajv.compile(
      document.components!.schemas!.ContextRangeTimestamp,
    );
    for (const [key, value] of Object.entries(query)) {
      if (/^(added|activity)(From|To)$/.test(key)) {
        expect(timestamp(value)).toBe(true);
      }
    }
  });

  it('rejects context-only PATCH at schema level, matching the service guard', () => {
    const schema = ajv.compile({
      components: document.components,
      $ref: '#/components/schemas/UpdateProspectRequest',
    });
    expect(schema({ contextCampaignId: 'campaign-synthetic' })).toBe(false);
    expect(schema({})).toBe(false);
    expect(schema({ name: 'Sintético' })).toBe(true);
  });

  it('validates additive campaign and provenance response examples', () => {
    const compileResponse = (name: string) =>
      ajv.compile({
        components: document.components,
        $ref: `#/components/responses/${name}/content/application~1json/schema`,
      });
    const meta = { page: 1, limit: 20, total: 1, totalPages: 1 };
    const campaigns = compileResponse('ProspectCampaignsResponse');
    const body = {
      success: true,
      data: {
        originCampaignId: 'campaign-A',
        campaigns: [
          {
            campaign: { id: 'campaign-B', name: 'Sintética', status: 'ACTIVA' },
            isOrigin: false,
            stage: 'CONTACTADO',
            evaluation: 'APTO',
            responsible: null,
            latestActivity: null,
            addedAt: '2026-11-22T00:00:00Z',
          },
        ],
        meta,
      },
    };
    expect(campaigns(body)).toBe(true);
    expect(campaigns({ success: true, data: [] })).toBe(false);
    const provenance = compileResponse('ProspectProvenanceResponse');
    expect(provenance({ success: true, data: [], meta })).toBe(true);
    expect(provenance({ success: true, data: { events: [], meta } })).toBe(
      false,
    );
  });

  it.each([
    { addedFrom: '2026-11-22' },
    { addedTo: '2026-11-22T00:00:00' },
    { activityFrom: '2026-02-30T00:00:00Z' },
    { activityTo: 'not-a-date' },
    { addedFrom: '2026-11-23T00:00:00Z', addedTo: '2026-11-22T00:00:00Z' },
    {
      activityFrom: '2026-11-23T00:00:00Z',
      activityTo: '2026-11-22T00:00:00Z',
    },
  ])('normalizes invalid or inverted ranges to HTTP 400: %j', async (query) => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    await expect(
      pipe.transform(query, {
        type: 'query',
        metatype: CampaignProspectsQuery,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(
      document.paths['/api/v1/campaigns/{id}/prospects'].get!.responses['400'],
    ).toEqual({ $ref: '#/components/responses/BadRequest' });
  });

  it.each([{ page: '1', limit: '1' }, { page: '2', limit: '100' }, {}])(
    'accepts fixed-order collection query boundaries: %j',
    (query) => {
      expect(errors(plainToInstance(ProspectHistoryQuery, query))).toEqual([]);
    },
  );

  it.each([
    { page: '0' },
    { page: '1.5' },
    { limit: '0' },
    { limit: '101' },
    { limit: 'abc' },
    { tenantId: 'client-controlled' },
    { sortBy: 'name' },
  ])('rejects invalid history collection queries: %j', (query) => {
    expect(
      errors(plainToInstance(ProspectHistoryQuery, query)).length,
    ).toBeGreaterThan(0);
  });

  it.each(['campaign-synthetic', 'x'.repeat(128)])(
    'accepts optional contextual PATCH id %s',
    (contextCampaignId) => {
      const body = { name: 'Sintético', contextCampaignId };
      const schema = ajv.compile({
        components: document.components,
        $ref: '#/components/schemas/UpdateProspectRequest',
      });
      expect(schema(body)).toBe(true);
      expect(errors(plainToInstance(UpdateProspectRequest, body))).toEqual([]);
    },
  );

  it.each([null, '', '   ', 'x'.repeat(129), 123])(
    'rejects invalid contextual PATCH id %j',
    (contextCampaignId) => {
      const body = { name: 'Sintético', contextCampaignId };
      const schema = ajv.compile({
        components: document.components,
        $ref: '#/components/schemas/UpdateProspectRequest',
      });
      expect(schema(body)).toBe(false);
      expect(
        errors(plainToInstance(UpdateProspectRequest, body)).length,
      ).toBeGreaterThan(0);
    },
  );

  it('preserves additive response shapes, eligibility and fixed-order pagination', () => {
    const schemas = document.components!.schemas!;
    expect((schemas.Prospect as SchemaObject).properties!.status).toEqual({
      $ref: '#/components/schemas/ProspectStatus',
    });
    expect(
      (schemas.ResponsibleUser as SchemaObject).properties!.eligible,
    ).toMatchObject({
      type: 'boolean',
    });
    expect(
      (schemas.ResponsibleUser as SchemaObject).properties!.userTenants,
    ).toBeUndefined();
    const campaigns = schemas.ProspectCampaigns as SchemaObject;
    expect(campaigns.properties!.originCampaignId).toEqual({ type: 'string' });
    expect(campaigns.properties!.meta).toEqual({
      $ref: '#/components/schemas/PaginationMeta',
    });
    const items = (campaigns.properties!.campaigns as SchemaObject)
      .items as SchemaObject;
    expect(items.properties!.latestActivity).toMatchObject({
      nullable: true,
      required: ['id', 'type', 'content', 'recordedAt'],
    });
    for (const suffix of ['campaigns', 'provenance']) {
      const operation = document.paths[`/api/v1/prospects/{id}/${suffix}`].get!;
      expect(operation.parameters).toEqual([
        { $ref: '#/components/parameters/EntityId' },
        { $ref: '#/components/parameters/Page' },
        { $ref: '#/components/parameters/Limit' },
      ]);
      expect(operation.responses['400']).toBeDefined();
    }
    expect(
      document.paths['/api/v1/prospects/{id}/campaigns'].get!.description,
    ).toContain('campaignId ascendente');
  });

  it('documents contextual list filters, participation and snapshot dashboard', () => {
    const list = document.paths['/api/v1/campaigns/{id}/prospects'].get!;
    const names = (list.parameters ?? []).map((parameter) =>
      '$ref' in parameter ? parameter.$ref.split('/').pop() : parameter.name,
    );
    for (const filter of [
      'addedFrom',
      'addedTo',
      'activityFrom',
      'activityTo',
      'CommercialStageFilter',
      'CommercialEvaluationFilter',
      'ResponsibleFilter',
    ])
      expect(names).toContain(filter);
    expect(list.responses['400']).toBeDefined();
    expect(list.description).toContain('AND');
    expect(list.description).toContain('recordedAt');
    const participation = document.components!.schemas!
      .CampaignParticipation as SchemaObject;
    for (const field of [
      'campaignId',
      'prospectId',
      'status',
      'commercialStage',
      'evaluation',
    ])
      expect(Object.keys(participation.properties!)).toContain(field);
    expect(participation.properties!.commercialStage).toEqual({
      $ref: '#/components/schemas/CommercialStage',
    });
    expect(participation.properties!.responsible).toMatchObject({
      nullable: true,
    });
    expect(
      document.paths['/api/v1/campaigns/{id}/dashboard'].get!.description,
    ).toContain('instantánea');
  });

  it('serves current deployment CP paths and schemas through isolated Swagger HTTP without DB', async () => {
    const app: INestApplication = await NestFactory.create(IsolatedDocsModule, {
      logger: false,
    });
    try {
      SwaggerModule.setup('api/docs', app, deploymentDocument(), {
        jsonDocumentUrl: 'api/docs/json',
      });
      await app.init();
      const server = app.getHttpServer() as Server;
      const response = await request(server).get('/api/docs/json').expect(200);
      const served = response.body as OpenAPIObject;
      for (const [path, item] of Object.entries(document.paths)) {
        if (/^\/api\/v1\/(campaigns|prospects)(\/|$)/.test(path)) {
          expect(served.paths[path]).toEqual(item);
        }
      }
      for (const [name, schema] of Object.entries(
        document.components!.schemas!,
      )) {
        expect(served.components!.schemas![name]).toEqual(schema);
      }
      await request(server).get('/api/docs/').expect(200);
    } finally {
      await app.close();
    }
  });
});
