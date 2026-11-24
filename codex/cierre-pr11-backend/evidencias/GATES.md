# Gates de cierre técnico

| Gate | Estado | Evidencia |
|---|---|---|
| C0 | PASS | Identidad, baseline, PR, refs, árbol, alcance y destino Docker confirmados. [Baseline](BASELINE.md) |
| C1 | PASS | 36 commits originales y 4 commits posteriores de código/QA, padres y autores verificados. El commit documental de publicación se identifica en el recibo. [Matriz de commits](MATRIZ_COMMITS.csv) |
| C2 | PASS | Dos defectos reproducidos y corregidos. Pruebas dirigidas y controles del candidato en [Resultados](RESULTADOS.md). [Hallazgos](HALLAZGOS.md) |
| C3 | BLOCKED | Migración vacía y ADR-006 poblada, interrupción, restauración, concurrencia de identidad/CSV, aislamiento y mediciones acreditados. Pendiente el criterio y la verificación específica de asignación durante revocación CP-02. [Migración](MIGRACION.md), [Hallazgos](HALLAZGOS.md) |
| C4 | PASS | Calidad local Linux/Node 20, matriz 50 AC y T01–T31 de backend, paridad contractual y smoke local. [QA](MATRIZ_QA.csv), [Contrato](CONTRATO_Y_HANDOFF.md) |
| C5 | IN_PROGRESS al fijar este documento | El recibo local `RECIBO_CI_FINAL.md` registra el resultado posterior al único push y los jobs del SHA publicado. |
| C6 | BLOCKED | Handoff disponible y plan simulado. Queda una decisión del owner y su validación dirigida. [Handoff](HANDOFF_FINAL.md) |

T32 `NOT_RUN`. G6 del sprint original permanece pendiente de decisión del owner.
