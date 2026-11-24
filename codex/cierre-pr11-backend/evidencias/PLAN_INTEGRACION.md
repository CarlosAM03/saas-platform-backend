# Ensayo local y propuesta para el owner

Refs comprobadas en el preflight: `dev=09593bb715cd83270821d34126a4344c8ef97cb0`, `main=431ca90af3ade893e35195a2d7143e8ad36ee1f5`, `CP=a68cc4e62ab7510503c617f4c78d00d561c52681`.

1. Simulación `git merge-tree --write-tree origin/dev origin/main`. Salió 0 y produjo `f8cc8d3d391eb09b44f80947f8df9ee711f8d343`, idéntico a `origin/main^{tree}`. `git merge-base origin/dev origin/main` = dev. Por esa ascendencia, un merge normal de main a dev tiene el mismo árbol que main y conserva ambos historiales.
2. Simulación de la segunda etapa con `git merge-tree --write-tree origin/main a68cc4e`. Salió 0 y produjo `e386244a398b063090ce950968b9f5a1674cb4ff`, idéntico a `a68cc4e^{tree}`. Al partir de la etapa 1, el commit resultante conservaría la ascendencia de main. El delta de main al árbol resultante equivale al delta CP respecto de ADR-006.
3. Cuando exista autorización posterior, actualizar refs y simular de nuevo para el SHA publicado y base vigentes. El owner puede sincronizar dev con main mediante merge normal y, tras comprobar los checks sobre esa base, integrar el PR #11 a dev mediante merge normal. Verificar ascendencia de main, diff neto y CI del resultado antes de considerar promoción.
4. Si el owner integra primero PR #11, deberá incorporar main a dev mediante merge normal antes de cualquier promoción y verificar el árbol combinado. Esa opción conserva historia pero hace revisar inicialmente commits heredados de ADR-006 dentro del PR.

El ensayo calculó objetos de árbol mediante `merge-tree`. Las refs compartidas y el PR quedaron sin modificaciones por el ensayo.

Repetición con `706cdbf679ec4ac82d89eddfc89fd132fd7575e1`: etapa 2 exit 0, árbol `f185e1e26b668cd195299f461405ba165d82d7a7`, igual al árbol del candidato. El paquete de evidencias será un delta documental sobre este SHA.

Continuación CP-02: `git merge-tree --write-tree origin/main 1aacee9` produjo `fbeb704202808d5fbf8681c5baa5438965b10780`, idéntico al árbol de código validado. El commit posterior actualiza el paquete de evidencias.
