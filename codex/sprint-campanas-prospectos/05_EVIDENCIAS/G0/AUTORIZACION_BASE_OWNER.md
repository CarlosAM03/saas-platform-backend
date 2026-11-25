# G0 — Autorización para iniciar sprint

**ESTADO: APROBADO CONDICIONALMENTE PARA INICIO**

- Fecha/canal de instrucción real owner: `2026-11-21`, canal de conversación del sprint
- Autoridad responsable: owner técnico y de producto del proyecto
- Backend repo: `CarlosAM03/saas-platform-backend`
- Base autorizada exacta (rama/ref y **SHA completo**): `feat/tenant-register@5e214420394101ae7079f8e844cc759b01cce2a3`
- Estado/cierre de Backend PR #10: `ABIERTO; HEAD del PR 5e214420394101ae7079f8e844cc759b01cce2a3; mergeable_state=clean; sin merge realizado`
- Estado/cierre de Flutter PR #11: `ABIERTO; HEAD del PR 0fe5d368e11b1da745ccf42ead3892470dcae0be; mergeable_state=clean; sin merge realizado`
- Rama nueva del sprint: `feat/sprint-campana-prospector`
- Árbol previo: `solo archivos untracked del arnés; cero cambios rastreados fuera del arnés`
- Instrucción textual del owner, con alcance: `Autorizar iniciar este sprint sin esperar al cierre de PR #10/#11, siempre que G0 confirme ausencia de conflictos o pendientes técnicos comprometedores. Base condicional: feat/tenant-register@5e214420394101ae7079f8e844cc759b01cce2a3. Si HEAD coincide y el árbol es seguro, crear rama nueva y registrar esta autorización. Revisión/cierre de PR, validación Brevo y despliegue quedan al owner.`
- Evidencia del mensaje/aprobación: `Mensaje oficial del owner recibido en el turno de activación del sprint; transcript disponible en la sesión`
- Actor que verificó: `Agente integrador backend`
- Resultado del gate: `PASS PARA INICIAR G1; no constituye autorización de merge, despliegue, migración productiva ni cierre de PR`

## Observación

Los SHAs `5e214420...` y `0fe5d368...` de la auditoría son referencias del PR **anterior**, no una orden para iniciar cambios. Aunque los PR se fusionen, G0 exige confirmación del punto de arranque. No crear ramas/escrituras antes de ello.
