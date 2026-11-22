# Solicitudes formales al owner

| ID | Gate | Conflicto / evidencia | Cambio protegido o regla | Opciones + tradeoffs | Decisión owner / fecha / canal | Estado |
|---|---|---|---|---|---|---|
| G2-O1 | G2 | El baseline solo expone `source=google_maps` con `sourceIdentifier`; no hay catálogo verificable de formatos fuertes | Identidad fuerte P1 | (A) Limitar fuerte a google_maps con identificador no vacío y único; (B) esperar catálogo/validador propietario | PENDIENTE_VALIDACION_G3 | ABIERTO_SIN_BLOQUEO |
| G4-O2 | G4 | `G2-05` y `G2/DISENO_LOCAL.md` declaran `candidateId` estable y revalidado para CSV; el flujo real rechaza múltiples candidatos como `CONFLICT/REJECTED` y el DTO no admite `candidateId` | P4 CSV, resolución de múltiples candidatos | (A) ratificar rechazo seguro permitido por SPEC B3/T04 y corregir documentación que afirma selección; (B) autorizar extensión aditiva `candidateId` con revalidación server-side, contrato y QA PG; (C) diferir decisión manteniendo el rechazo seguro sin declarar selección disponible | Owner: ratifica alternativa A, mantener rechazo seguro durante este sprint; instrucción de conversación 2026-11-22. Se debe alinear la documentación y probar rechazo sin escrituras. | RESUELTO_PARA_P4; NO_BLOQUEA_G4 |

Si una decisión se aprobó por otro canal, documentar el texto/alcance concreto. No asumirla automáticamente.
