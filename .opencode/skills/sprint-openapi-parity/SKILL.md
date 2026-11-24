---
name: Sprint OpenAPI Parity
description: Cómo reconciliar rutas NestJS, deploymentDocument, YAML de contrato y Swagger servido del sprint CP, sin inventar endpoints.
---

# Paridad de contrato — sprint CP

Objetivo: que código, `deploymentDocument`, `Docs/Contracts/platform-api.v1.yaml` y `/api/docs` digan lo mismo. Usa español de México y no uses voseo.

## Pasos

1. **Enumera las rutas reales:**
   ```powershell
   Select-String -Path "src/campaigns/*.ts","src/prospects/*.ts" -Pattern "@(Get|Post|Patch|Put|Delete)\("
   ```
   Anota también los decoradores de rol (`@Roles`) y el DTO de cada una.

2. **Enumera lo declarado** en `src/common/openapi/deployment-document.ts` y en `Docs/Contracts/platform-api.v1.yaml`.

3. **Compará en tres direcciones:**
   - código → doc: ¿hay ruta implementada sin documentar?
   - doc → código: ¿hay ruta documentada sin implementar? → es `CONTRACT_ONLY`, no disponible.
   - YAML → Swagger servido: ¿el documento servido en `/api/docs` refleja el YAML?

4. **Para cada operación nueva** define: method, path, request schema, response schema, códigos de error, roles, tenant y estado:
   - `AVAILABLE`: implementado **y** probado
   - `CONTRACT_ONLY`: documentado, sin implementación o sin prueba
   - `503`: existe pero deshabilitado por flag

5. **Verifica la salida servida** con la app levantada:
   ```powershell
   Invoke-RestMethod http://localhost:3000/api/docs/json
   ```

6. **Registra el DRIFT** en `05_EVIDENCIAS/G4/` con severidad y riesgo.

## Reglas

- Nunca agregues una ruta al contrato "porque el SPEC la pide" sin que exista en el código.
- Nunca marques `AVAILABLE` sin evidencia de prueba.
- Si el cambio rompe consumidores existentes, clasificalo `BREAKING_CHANGE` y escalalo antes de publicarlo.
- No modifiques contratos de Flutter ni el contrato core que ya es baseline, salvo autorización.
