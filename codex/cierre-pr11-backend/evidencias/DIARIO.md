# Diario de ejecución

| Fecha local | SHA | Operación | Evidencia |
|---|---|---|---|
| 2026-11-23 | `a68cc4e62ab7510503c617f4c78d00d561c52681` | Preflight, fetch, PR y refs; instalación del paquete de cierre | [BASELINE](BASELINE.md) |
| 2026-11-23 | `a68cc4e62ab7510503c617f4c78d00d561c52681` | Inventario lineal, revisión de padres y áreas sensibles, exclusión PR #6 | [Matriz](MATRIZ_COMMITS.csv) |
| 2026-11-23 | `a68cc4e62ab7510503c617f4c78d00d561c52681` | Auditoría npm, guardas, reconciliación de hashes del arnés y simulación de árboles | [Dependencias](DEPENDENCIAS.md), [Contrato](CONTRATO_Y_HANDOFF.md), [Integración](PLAN_INTEGRACION.md) |
| 2026-11-23 | `a68cc4e62ab7510503c617f4c78d00d561c52681` | Regresión completa baseline y reproducciones dirigidas C4-SEL/P3-CSV | [Hallazgos](HALLAZGOS.md) |
| 2026-11-23 | `92b77d347dc0017ab769b615a951e201b6a8a0e3` | Ajuste aditivo de elegibilidad y aserción del selector | C4-SEL |
| 2026-11-23 | `aef737f20382c7886c57975e327c6f63a07bc68b` | Primer arreglo del replay y regresión local (178 unitarias, 84 HTTP, 200 PG) | P3-CSV |
| 2026-11-23 | `d3d52ee3b3bff172cd7a925334432d7c4791e1a4` | Conteo en el snapshot y caso concurrente. Lint Linux rechazó el comparador inseguro del test. | P3-CSV |
| 2026-11-23 | `706cdbf679ec4ac82d89eddfc89fd132fd7575e1` | Se ajustó la aserción del test, se reexportó y se reejecutó el pipeline y runtime del candidato | [QA](MATRIZ_QA.csv) |
| 2026-11-24 | `81fa2652feec48ef853d0d3f61cf62ddd8d7f482` | Decisión del owner, preflight remoto, inspección de Users y reproducción CP-02 mediante cuatro casos concurrentes en PG16 | [CP-02](CP02.md) |
| 2026-11-24 | `1aacee9928a0d526b4c76dfc26cf6a7ed6703c25` | Corrección de Campaigns y seis casos dirigidos. Verificación contractual desde runtime sobre PG16 | [CP-02](CP02.md), [Contrato](CONTRATO_Y_HANDOFF.md) |
