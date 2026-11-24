# Auditoría de dependencias

Ejecución propia del 23 de noviembre de 2026 (Tijuana) sobre `a68cc4e62ab7510503c617f4c78d00d561c52681`, lockfile versionado, host npm 11.7.0. Esperado: salida 0 al umbral alto en ambos árboles.

| Comando | Observado | Resultado |
|---|---|---|
| `npm audit --audit-level=high --json` | 25 moderadas, 0 altas o críticas, exit 0 | PASS al umbral |
| `npm audit --omit=dev --audit-level=high --json` | 0 vulnerabilidades, exit 0 | PASS |

Los paquetes reportados incluyen `glob` y `minimatch` y paquetes ascendentes de Jest/cobertura, Nest CLI y typescript-eslint. Exposición observada en el árbol de tooling local/CI. El resultado depende de la instantánea del registro. Conservar el lockfile, revisar estas rutas de dependencia en el mantenimiento de tooling y revalidar al actualizar. Sin `audit fix` ni cambios de Node o dependencias.

Repetición sobre la imagen de desarrollo de `706cdbf679ec4ac82d89eddfc89fd132fd7575e1`, npm 10.8.2 y Node 20.20.2. Mismos resultados y exit 0 en ambos comandos. Directas reportadas en el árbol completo: `@nestjs/cli`, `jest` y `typescript-eslint`. En producción el conteo se mantuvo en cero.
