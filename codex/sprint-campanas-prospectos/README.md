# Arnés de ejecución — Sprint CP (Campañas y Prospectos)

**Identificador:** HARNESS-CP-2026-01 · **Edición:** 1.0 · **Idioma:** español  
**Rol principal:** Ángel / agente integrador backend (con o sin subagentes).  
**Repositorio de trabajo esperado:** `CarlosAM03/saas-platform-backend`.  
**Autoridad funcional:** `04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md`.  
**Estado:** arnés preparado para uso. **No confiere GO G0 ni permiso de merge/despliegue.**

## Instalación

Descomprime el ZIP y copia **la carpeta `sprint-campanas-prospectos` completa**, sin sobrescribir otros trabajos, a:

```text
<saas-platform-backend>/codex/sprint-campanas-prospectos/
```

Si ya existe una carpeta del mismo nombre con trabajo o evidencias, **no la reemplaces**: compara ambas y acuerda preservación con el owner. No copiar este arnés directamente a Flutter para ejecutar cambios; el arnés de André se generará desde el backend entregado.

## Activación

Abre **la raíz del backend** como workspace del agente y pega el texto íntegro de `00_PROMPT_ACTIVACION.txt`. No basta con dejar la carpeta en `codex/`: el ejecutor debe leer explícitamente el prompt y el SPEC.

El prompt fuerza preflight G0. Si el owner todavía está revisando o cerrando los PR previos, el agente **solo puede preparar lectura, inventario y una propuesta de base**; no debe alterar código funcional ni iniciar migraciones ni crear una rama como si hubiera permiso. La aprobación del SPEC **no** se equipara al permiso de ejecución G0.

## Lectura obligatoria, en este orden

1. `00_PROMPT_ACTIVACION.txt`.
2. `01_GOBIERNO/01_AUTORIDAD_PRECEDENCIA.md`.
3. `04_REFERENCIAS/SPEC_SPRINT_CAMPANAS_PROSPECTOS_v1.0_OWNER_APROBADO.md` **íntegro**.
4. `01_GOBIERNO/02_ALCANCE_Y_LIMITES.md` y `01_GOBIERNO/03_RAMAS_G0.md`.
5. ADR-004, ADR-003, ADR-006, `MODULE-DEVELOPMENT.md`, esquema/migraciones y contrato OpenAPI del **checkout autorizado**, no solo las referencias antiguas.
6. `02_EJECUCION/00_PLAN_FASES.md`, `03_CALIDAD/MATRIZ_AC_Y_TESTS.md` y `05_EVIDENCIAS/README.md`.
7. Antes del handoff: `06_HANDOFF_ANDRE/00_CONTRATO_DE_ENTREGA.md`.

Si existe `AGENTS.md` u otra norma aplicable en el checkout, se debe leer y cumplir. Un conflicto entre instrucciones requiere detener **solo la operación afectada** y elevarlo al owner; el arnés no sustituye permisos del entorno.

## Funcionalidades cerradas (10)

**Campañas:** C1 Pipeline; C2 Evaluación; C3 Bitácora; C4 Responsables; C6 Filtros; C8 Dashboard **por campaña**.  
**Prospectos:** P1 Identidad/reutilización; P2 Campañas asociadas; P3 Procedencia; P4 Importación CSV V1 ampliada.

Las decisiones A1–A5, B1–B7, C1–C7, D1–D4 y E1–E5 fueron ratificadas íntegramente por el owner en el SPEC. Cualquier nueva regla de negocio requiere autorización posterior; no se inventan decisiones a partir del código accidental.

## Referencias y su autoridad

- **Normativa vigente de este sprint:** SPEC aprobado (copia íntegra). No editar su contenido; emitir una enmienda separada si el owner cambia una regla.
- **Histórico de análisis:** auditoría y documentos anteriores incluidos, marcados explícitamente como históricos. No prevalecen sobre el SPEC.
- **Autoridad técnica verificable:** checkout real del backend y sus ADR, contratos y tests en el SHA efectivamente autorizado. Releer en G1, registrar discrepancias. No tomar `dev` ni `main` por defecto.
- **Paquete:** `MANIFEST_INTEGRIDAD.json` almacena huellas de documentos y herramientas de arranque para detectar cambios accidentales; no sustituye control de versiones ni autorización humana.

## Operación mínima segura

```bash
node codex/sprint-campanas-prospectos/herramientas/preflight.mjs
node codex/sprint-campanas-prospectos/herramientas/verificar-integridad.mjs
```

El primero es **solo lectura** y no supone aprobación G0; opcionalmente `--guardar` emite un resumen saneado en evidencias. El segundo verifica que los textos rectores entregados no cambiaron; no valida la implementación.

## Resultado esperado

Backend funcional y verificado por SHA exacto, migración ensayada sobre PostgreSQL **sintético**, OpenAPI/Swagger coherentes, trazabilidad AC/pruebas, evidencia sin secretos, PR para revisión del owner y un arnés **nuevo**, específico para André, generado por Ángel desde el contrato realmente implementado. La aceptación y la promoción siguen siendo decisión del owner.

**No incluidos:** ejecutores automáticos de Git, scripts de migración, credenciales, archivos de producción ni un arnés frontend ficticiamente completado.
