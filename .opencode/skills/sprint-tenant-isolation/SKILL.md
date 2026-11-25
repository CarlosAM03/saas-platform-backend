---
name: Sprint Tenant Isolation
description: Fixtures y patrones de prueba de aislamiento de tenant, roles y ocultación 404 para las rutas nuevas del sprint CP.
---

# Aislamiento de tenant — sprint CP

Usa español de México y no uses voseo.

## Fixture base

Crea dos tenants sintéticos con datos **homónimos** (mismo nombre, mismo email, misma dirección) para que un fallo de filtro sea visible:

- Tenant A: campaña `Campana demo`, prospect `Empresa Demo`, email `contacto@demo.test`
- Tenant B: campaña idéntica, prospect idéntico, email idéctico

Agrega usuarios: `ADMIN` global, `OWNER` y `MEMBER` de cada tenant.

## Qué verificar en cada ruta nueva

1. **Lectura cruzada** → `404`, nunca `403` ni datos del otro tenant. La ocultación no debe confirmar existencia.
2. **Escritura cruzada** → `404` (o `403` si el diseño lo exige), sin cambios en la base del tenant ajeno.
3. **IDs cruzados** → un ID del tenant B con sesión de tenant A: sin resultado, sin fuga.
4. **Filtros (C6)** → el conteo de tenant A no cambia cuando se agregan datos a B.
5. **Dashboard (C8)** → totales únicos por participación, no multiplicados por joins; sin agregados de otro tenant.
6. **Responsables (C4)** → no se puede asignar como responsable a un usuario que no pertenece al tenant actual.
7. **Identidad (P1)** → una clave fuerte no resuelve a un prospecto de otro tenant.
8. **CSV (P4)** → preview/confirm no cruzan tenant; la referencia firmada no sirve en otra sesión.
9. **Bitácora y procedencia (C3/P3)** → sin eventos ni apariciones de otro tenant.
10. **Campañas asociadas (P2)** → sin listado de campañas ajenas.

## Patrón de aserción

```ts
// Sintético: nunca datos reales
expect(crossTenantRead.status).toBe(404);
expect(JSON.stringify(crossTenantRead.body)).not.toContain("tenant-B-id");
```

También verifica que el wrapper `{ success, data, meta }` se conserve y que los errores no expongan SQL ni IDs internos ajenos.

## Cierre

Registra cada caso en la matriz con la skill `sprint-evidence`. Si un caso no se ejecutó, queda `NOT_RUN`.
