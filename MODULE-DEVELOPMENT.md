# Module Development Guide

Guia principal para Angel y agentes IA que implementen modulos funcionales sobre el baseline F4.

## Orden de lectura

1. [ADR-004](Docs/ADRs/ADR-004-CommonBaseline.md), decisiones transversales.
2. [OpenAPI Platform V1](Docs/Contracts/platform-api.v1.yaml), contrato publico.
3. [Prisma schema](Prisma/schema.prisma), modelo persistente.
4. [ADR-003](Docs/ADRs/ADR-003-AuthSecureTransversal.md), seguridad.
5. Este documento.
6. README local del modulo.

Los READMEs locales son contexto operativo especifico; esta guia sigue siendo la referencia general.

## Arquitectura modular

Cada modulo mantiene su limite de responsabilidad y se registra en `AppModule`:

```text
<module>/
├── <module>.module.ts
├── <module>.controller.ts
├── <module>.service.ts
├── dto/
├── services/
└── README.md
```

Flujo obligatorio:

```text
HTTP -> Controller -> DTO/ValidationPipe -> Service -> PrismaService -> PostgreSQL
```

Los Controllers no acceden directamente a Prisma. Los DTOs no contienen logica de persistencia.

## Crear un modulo

Desde `saas-platform-backend/`:

```powershell
nest g module <module>
nest g controller <module>
nest g service <module>
```

Registrar dependencias explicitas:

```typescript
@Module({
  imports: [CommonModule, PrismaModule],
  controllers: [CampaignsController],
  providers: [CampaignsService],
})
export class CampaignsModule {}
```

Registrar el modulo en `src/app.module.ts`. Mantener dependencias en una sola direccion y evitar ciclos.

## TenantContext y aislamiento

El tenant operativo proviene del contexto autenticado:

```typescript
constructor(private readonly tenantContext: TenantContextService) {}

const tenantId = this.tenantContext.requireTenantId();
const context = this.tenantContext.getRequiredContext();
```

Consulta tenant-aware:

```typescript
return this.prisma.campaign.findMany({
  where: { tenantId: this.tenantContext.requireTenantId() },
});
```

Nunca usar un `tenantId` enviado por el cliente como autoridad. ADMIN puede operar sin tenant para operaciones globales; una operacion tenant-scoped debe exigir `requireTenantId()`.

## Autenticacion y autorizacion

Los endpoints requieren autenticacion por defecto mediante `AuthGuard` global. Solo usar `@Public()` para endpoints realmente publicos, como health y login:

```typescript
@Public()
@Get('live')
live() {}
```

Declarar roles con `@Roles()`:

```typescript
@Roles('OWNER', 'ADMIN')
@Post()
create() {}
```

`ADMIN` se evalua contra `platformRole`; `OWNER` y `MEMBER` contra `tenantRole`. Un endpoint sin `@Roles()` significa autenticacion, no OWNER automatico.

Usar `@CurrentUser()` para la identidad autenticada:

```typescript
@Get('me')
getMe(@CurrentUser() user: AuthenticatedUser) {
  return this.service.getMe(user.id);
}
```

Nunca convertir ADMIN en OWNER o MEMBER por seleccionar un tenant.

## DTOs y validacion

Crear DTOs separados de Prisma y usar `class-validator`. El `ValidationPipe` global usa `whitelist`, `forbidNonWhitelisted` y `transform`. No aceptar propiedades no documentadas por OpenAPI.

## Respuestas y errores

El interceptor global normaliza respuestas exitosas. Los Services pueden devolver:

```typescript
return { data: campaigns, meta: paginationMeta };
```

El resultado HTTP es `{ success: true, data, meta? }`. No crear wrappers alternativos ni devolver body en `204`.

Usar excepciones NestJS y dejar que `GlobalExceptionFilter` las normalice:

```typescript
throw new NotFoundException('Campaign not found');
throw new ForbiddenException('Insufficient permissions');
throw new ConflictException('Campaign already exists');
```

Los errores siguen `{ success: false, error: { code, message, details, timestamp } }`.

## Paginacion

Usar `PaginationDto` para listados. `limit` no puede superar 100. Devolver metadata con `page`, `limit`, `total` y `totalPages`.

## Logging y requestId

Usar Pino para eventos relevantes. El request ID esta disponible en `X-Request-Id` y debe acompañar logs y diagnosticos. Nunca registrar passwords, hashes, JWT, API keys o secretos.

## Pruebas

Cada modulo debe probar:

- autenticacion y roles;
- aislamiento entre tenants;
- validacion de DTOs;
- casos de exito y errores 400/401/403/404/409;
- respuestas paginadas;
- reglas principales del dominio.

Ejecutar desde `saas-platform-backend/`:

```powershell
npm run test
npm run test:e2e
```

El servidor normal requiere PostgreSQL; las pruebas aisladas pueden usar doubles de Prisma.

## Decisiones congeladas

No modificar unilateralmente:

- ADRs y contratos OpenAPI;
- `Prisma/schema.prisma`;
- JWT Bearer, HS256, expiracion de 8 horas, sin refresh token ni blacklist;
- `platformRole` ADMIN y `UserTenant.roleId` para OWNER/MEMBER;
- AuthGuard, RolesGuard y TenantContext;
- aislamiento tenant-aware;
- response wrapper, error format, ValidationPipe y requestId;
- PrismaService singleton, Pino y bcrypt cost 12.

Si una feature necesita cambiar una de estas decisiones, detener la implementacion y solicitar una decision formal.

## Reportar contradicciones

El reporte debe incluir:

1. Que se intenta implementar.
2. Que fuente contradice el comportamiento.
3. Documento y seccion que fijan la decision.
4. Diferencia exacta.
5. Alternativas validas.
6. Impacto de cada alternativa.
7. Recomendacion y decision requerida.

No ocultar contradicciones con casts, campos inventados, tenants ficticios o cambios silenciosos.

## Modulos preparados

- [Tenants](src/tenants/README.md)
- [Campaigns](src/campaigns/README.md)
- [Prospects](src/prospects/README.md)
- [Prospecting Jobs](src/prospecting-jobs/README.md)
- [Prospector Client](src/prospector-client/README.md)

- documentacion tecnica: ✅ Server running on http://localhost:3000 📄 Swagger UI: http://localhost:3000/api/docs

 API base: http://localhost:3000/api/v1

## Precisiones F4 de ejecución

La jerarquía empieza por ADR-004 y el registro F4. Middleware abre un alcance AsyncLocalStorage por request; AuthGuard lo completa una sola vez tras verificar JWT. Los Services consumen el contexto, nunca lo escriben. UserTenant se valida en login/select-tenant; las requests usan el snapshot y verifican usuario activo. No sustituir este contexto por un objeto global en los tests.

Auth/me permite identidad sin tenant seleccionado y devuelve el token presentado sin renovarlo. Users requiere tenant incluso para ADMIN; roleId omitido se resuelve a MEMBER. El requestId se crea antes de guards para cubrir errores 401/403. Evitar logs de headers, cuerpos, query strings y valores sensibles.

Las correcciones conforme a F4 no requieren reabrir decisiones anteriores. Solo una nueva decisión arquitectónica requiere escalar la parte afectada.
