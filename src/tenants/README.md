# Tenants Module

## Proposito

Gestionar organizaciones tenant y su ciclo de vida. El tenant es el limite de aislamiento logico del backend.

## OpenAPI relacionado

- `GET /api/v1/tenants`: lista tenants accesibles al usuario.
- `POST /api/v1/tenants`: crea un tenant; requiere autorizacion administrativa.
- `GET /api/v1/tenants/{id}`: consulta un tenant accesible.

## Estado funcional

Implementado sobre el baseline F4:

- `GET /api/v1/tenants` funciona antes de seleccionar tenant. ADMIN lista todas las organizaciones; los demas usuarios reciben solo sus membresias en tenants activos.
- `GET /api/v1/tenants/{id}` aplica el mismo alcance. Un tenant ajeno, inexistente o suspendido para un usuario normal responde `404`.
- `POST /api/v1/tenants` requiere ADMIN y recibe exclusivamente `name` y `slug`. Crea el tenant ACTIVO junto con sus roles OWNER/MEMBER mediante una escritura anidada atomica. Un slug duplicado responde `409`.
- Crear una organizacion no agrega una membresia al ADMIN ni cambia su contexto. Despues puede seleccionarla mediante Auth y crear usuarios con los roles de esa organizacion.
- Las respuestas seleccionan solo los campos de Tenant definidos por OpenAPI; no incluyen membresias ni roles internos.

El listado conserva el contrato especifico de Platform API V1: no declara parametros de paginacion y devuelve un array en `data`. La pauta general de `PaginationDto` no se extiende silenciosamente a esta ruta. Introducir paginacion requiere alinear el contrato para no truncar el selector de organizaciones.

## Dependencias

- `PrismaService` para `Tenant`, `UserTenant` y `Role`.
- `TenantContextService` para el contexto operativo.
- `@Roles('ADMIN')` para operaciones globales de administracion.
- El usuario autenticado se obtiene del snapshot de `TenantContextService` para filtrar membresias.
- `ResponseInterceptor` y `GlobalExceptionFilter` existentes.

## Reglas

No aceptar un tenant como autoridad solo por un id enviado por el cliente. No crear un system tenant para representar ADMIN. Las operaciones sobre datos tenant-aware deben validar contexto y pertenencia.

## Verificacion

`test/platform.e2e-spec.ts` cubre autenticacion, permisos ADMIN/OWNER/MEMBER, descubrimiento sin tenant seleccionado, acceso ajeno, tenants suspendidos, creacion y roles, slugs duplicados, validacion de DTOs, integracion con Auth/Users y consultas concurrentes.

Las pruebas conservan JWT, guards y AsyncLocalStorage reales y sustituyen Prisma. `test/setup-env.ts` configura el entorno aislado antes de importar AppModule. La validacion contra PostgreSQL real requiere un entorno de base de datos configurado.

No se agregan actualizacion o eliminacion de tenants: no estan definidas en el contrato V1 vigente.

Consultar `MODULE-DEVELOPMENT.md` antes de implementar.

## Archivos y responsabilidades

Las rutas de esta tabla parten de la raiz del repositorio.

| Archivo | Responsabilidad |
| --- | --- |
| `src/tenants/dto/create-tenant.request.ts` | Creado. Valida name y slug como textos. |
| `src/tenants/dto/tenant.response.ts` | Creado. Describe los campos públicos de una organización. |
| `src/tenants/tenants.controller.ts` | Creado. Expone listado, consulta y creación; restringe la creación a ADMIN. |
| `src/tenants/tenants.service.ts` | Creado. Filtra organizaciones accesibles, crea tenant y roles de forma atómica y traduce slugs duplicados a 409. |
| `src/tenants/tenants.module.ts` | Modificado. Conecta el controlador, el servicio, Common y Prisma. |

La [entrega completa](../../Docs/ENTREGA-MODULOS-BACKEND.md) explica como se relaciona este modulo con los demas, las verificaciones realizadas y los pasos pendientes.
