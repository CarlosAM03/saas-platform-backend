# Core v1.0.0 — Avance 2

> Actualización G1 ADR-006, decisión owner D4 (28/10/2026): el riesgo histórico de JWT snapshot descrito abajo queda acotado para POST/PATCH/DELETE Users y altas/reenvíos de onboarding. Estas escrituras revalidan autoridad actual en PostgreSQL dentro de la transacción; el resto del modelo JWT de ocho horas permanece vigente. Se preserva el registro Core original y su evidencia. Véase [handoff G1](../../codex/backend-adr006/evidencias/10_HANDOFF_GATE1.md).

Base autorizada: `3a3309398458ab333d7b00f16e9c2df6a09ef734`. SEC-01 protege identidad global compartida y ADMIN ajeno dentro de transacción Serializable; conserva self-edit y asignación de rol del tenant. Se seleccionaron validación de configuración productiva, CORS trim, 413 y overrides de seguridad de forma acotada.

Prisma/schema, migración init, JwtStrategy, Jobs, cliente Prospector y contrato público baseline permanecen sin cambios. Sin P2, cuotas, snapshots de generación ni callbacks operativos. Las rutas de generación conservadas responden 503 tras validar; Idempotency-Key sigue obligatorio al crear.

JWT snapshot: riesgo residual ALTO de permisos de rol/membresía previamente emitidos hasta ocho horas; no resuelto por SEC-01. Usuario global inactivo devuelve 401. Se conserva por decisión expresa del owner; revocación dinámica queda fuera del alcance. Node 20 queda como deuda prioritaria posterior al cierre según el plan rector.

Validación local previa al PR (2026-10-27): 41 unitarias, 78 HTTP, 20 PostgreSQL en tres suites; lint, formato y tsc aprobados. Dockerfile runtime real construido/arrancado como usuario node, Node20.20.2 y PostgreSQL16 dedicado; smoke de 38 comprobaciones Auth/roles/tenant/CORS/CRUD/CSV/Jobs/Swagger1.0.0 aprobado. Audit producción: cero vulnerabilidades; árbol completo: ocho low en herramientas de desarrollo, cero moderate/high/critical. Estos resultados no certifican el HEAD integrado: se repiten checks y pruebas en dev antes de la promoción.

El tooling `ops/avance2` sirve exclusivamente la prueba local de A1/A2 con TLS validado en navegador aislado. No modifica almacén TLS del host. Contraseñas/JWT/DB se almacenan fuera del repositorio. No incorpora Service ni P2.

Orden preparado: Backend dev→main manual del owner, verificar Actions/Render y SHA; después Flutter dev→main manual y Vercel. Sin migración nueva ni seed productivo. Rollback: redeploy de revisión anterior verificada; cualquier revert de main requiere autorización. No se ejecuta despliegue desde este cambio.
