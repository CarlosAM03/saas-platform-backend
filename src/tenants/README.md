# Tenants Module

## Proposito

Gestionar organizaciones tenant y su ciclo de vida. El tenant es el limite de aislamiento logico del backend.

## OpenAPI relacionado

- `GET /api/v1/tenants`: lista tenants accesibles al usuario.
- `POST /api/v1/tenants`: crea un tenant; requiere autorizacion administrativa.
- `GET /api/v1/tenants/{id}`: consulta un tenant accesible.

## Dependencias

- `PrismaService` para `Tenant`, `UserTenant` y `Role`.
- `TenantContextService` para el contexto operativo.
- `@Roles('ADMIN')` para operaciones globales de administracion.
- `@CurrentUser()` para asociar operaciones al usuario autenticado.
- `RoleService` y `UserTenantService` del modulo Users cuando se creen membresias.
- `ResponseInterceptor`, `GlobalExceptionFilter` y `PaginationDto`.

## Reglas

No aceptar un tenant como autoridad solo por un id enviado por el cliente. No crear un system tenant para representar ADMIN. Las operaciones sobre datos tenant-aware deben validar contexto y pertenencia.

La implementacion funcional queda fuera del baseline F4; este README solo prepara el trabajo posterior.

Consultar `MODULE-DEVELOPMENT.md` antes de implementar.
