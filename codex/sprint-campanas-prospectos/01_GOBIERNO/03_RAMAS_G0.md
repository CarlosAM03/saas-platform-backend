# G0 — base Git autorizada y trabajo anterior

## Evidencia histórica (NO branch GO)

| Repositorio | PR anterior owner | Rama histórica | SHA de la auditoría |
|---|---|---|---|
| Backend `CarlosAM03/saas-platform-backend` | #10 abierto al auditar | `feat/tenant-register` | `5e214420394101ae7079f8e844cc759b01cce2a3` |
| Flutter `CarlosAM03/saas-platform-client` | #11 abierto al auditar | `feat/tenant-register` | `0fe5d368e11b1da745ccf42ead3892470dcae0be` |

Esos PR pertenecen al trabajo anterior; **el owner los revisa/cierra**. Ni `main` ni `dev` son base automática. No se permite modificar, fusionar ni cerrar los PR previos. CI histórico no demuestra el nuevo HEAD.

## G0 — exigencias antes de escribir código

1. Confirmar con el owner que la deuda y PR anteriores están resueltos o que autoriza explícitamente iniciar mientras están bajo revisión.
2. Registrar en `05_EVIDENCIAS/G0/AUTORIZACION_BASE_OWNER.md` **la instrucción real del owner**, origen/canal/fecha y su alcance. Si aún no existe, mantener `PENDIENTE`.
3. Registrar remoto, branch, SHA base **exacto**, `git status` incluyendo untracked, divergencia respecto a main y estado de tests/CI de ese SHA. Identificar cambios locales ajenos, sin hacer stash, checkout destructivo ni limpieza.
4. Proponer nombre de rama nuevo, no reutilizar la rama de PR anterior. Requerir GO del owner para crear/cambiar rama y actuar cuando corresponda.
5. Cuando el owner autorice una base exacta y el árbol esté seguro, crear/usar una **rama nueva separada** sin alterar ramas anteriores. El agente puede escoger nombre semántico salvo instrucción del owner.
6. Archivar evidencia G0 y comenzar G1. Si se detecta cambio de SHA o worktree, suspender escrituras y renovar verificación/GO.

## Cómo registrar GO válido

No existe una frase mágica que convierta un archivo en firma. Es necesario que Ángel pueda **citar una instrucción explícita y vigente del owner** con repositorio/base/SHA y alcance. `05_EVIDENCIAS/G0/AUTORIZACION_BASE_OWNER.md` es plantilla de transcripción/auditoría; no puede autoaprobarse por haber generado este ZIP.

**Ejemplo ilustrativo, NO autorizado actualmente:** «Inicio aprobado desde backend/main@<SHA real> en nueva rama para SPEC-CP-2026-01, manteniendo PR previos intactos».

No tocar repo Flutter durante el backend; consultar su código/documentación solamente cuando sea necesario para contratos. La futura base de André también debe autorizarla el owner.
