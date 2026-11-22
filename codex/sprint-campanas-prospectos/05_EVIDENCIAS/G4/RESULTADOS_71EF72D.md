# G4 — Regresion final sobre SHA 71ef72d

- Fecha: `2026-11-22T15:15:07-08:00`
- Rama: `feat/sprint-campana-prospector`
- HEAD: `71ef72d95537b12713dc81bb91b6abd03018df1c`
- Entorno: Windows host y Docker Compose con PostgreSQL 16 desechable

| Comando | Esperado | Observado | Resultado |
|---|---|---|---|
| `npm run build` | compilacion sin errores | codigo 0 | PASS |
| `npm run test:unit:ci` | suites verdes | 11 suites, 114/114 | PASS |
| `npm run test:e2e:ci` | suites verdes | 7 suites, 84/84 | PASS |
| `docker compose --profile test run --build --rm test-postgres` | PostgreSQL sintético verde | 11 suites, 98/98 | PASS |

Cobertura agregada:
- T01 alta manual sin identidad fuerte.
- T03 coincidencia débil sin reutilización automática.
- T05 resolución CREATE conserva datos anteriores.
- T08 LINK_EXISTING a relación existente sin duplicar ni reiniciar contexto.
- T16 responsable pierde elegibilidad y conserva historial.
- T18 JOIN con actividades sin duplicar participaciones.
- T20 dashboard vacío y legacy sin procedencia.
- T25 límite de 5 MB/1000 filas verificable; TTL 15 minutos aún no medido.

Limitaciones:
- T25 permanece PARCIAL.
- T32 pertenece a Flutter y permanece NOT_RUN.
- Rendimiento sintético medido y revisión independiente siguen pendientes.
