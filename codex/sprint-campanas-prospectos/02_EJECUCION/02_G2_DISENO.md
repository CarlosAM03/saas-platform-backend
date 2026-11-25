# G2 — Diseño técnico acotado (sin prescribir solución)

**Entrada:** G1 terminado; reglas y límites del SPEC confirmados.  
**Salida:** `05_EVIDENCIAS/G2/DISENO_LOCAL.md` con decisiones locales y riesgos.

Ángel debe justificar y probar su opción de diseño para:

1. Identidad tenant-wide fuerte `(fuente confiable, identificador válido)` y matching débil/revisión humana, con colisiones legacy. ¿Cómo se evita una doble alta concurrente sin imponer unique ciego sobre históricos? ¿Qué fuentes reales son confiables?
2. Evolución de alta manual y CSV sin silenciar coincidencias ni romper contratos antiguos. ¿Qué forma de preview/confirm manual o confirmación equivalente se necesita? ¿Cómo se maneja CREATE/LINK/UPDATE/SKIP y selección de candidato múltiple en CSV?
3. Participación existente, estado contextual separado y semántica del `status` histórico; backfill sin eventos falsos; no copiar maestros por campaña.
4. Eventos C3 append-only y procedencia P3 separados; atomicidad con cambios confirmados y deduplicación de eventos por reintento razonablemente demostrable.
5. Responsable elegible del tenant y caso de pérdida posterior de elegibilidad, sin cambiar usuarios/roles ni asumir ADMIN como miembro.
6. Filtros server-side, paginación y agregados C8 sin `JOIN` multiplicadores ni consultas repetitivas sin índices; métricas de incorporados/reutilizados/legado basadas en hechos reales.
7. Migraciones aditivas, continuidad de campañas origen, archivos CSV y datos legacy; ensayo sintético y plan forward-fix. Evitar cambios en migraciones históricas.
8. Contrato REST y autorización de endpoints nuevos, tipos de errores y compatibilidad Flutter. La elección de nombres de rutas/DTOs es local, pero debe quedar publicada y probada.
9. Estimación de riesgo/tiempo sin convertirla en deadline ni reducir tests obligatorios. Preservar calidad.

Registrar alternativas razonables y la seleccionada. La aprobación del SPEC no exige que el owner firme cada clase/índice. Solo elevar las excepciones definidas en `01_GOBIERNO/04_REGISTRO_ESCALAMIENTO.md`.
