# Validación local Avance 2

Ejecutar `pwsh -File ops/avance2/Start-Core.ps1` desde el Backend, con `flutter-core` como checkout hermano; usar `-FlutterPath` para otra ubicación. El launcher construye el Dockerfile runtime y Dockerfile.vercel originales, crea configuración local fuera del repositorio y verifica propiedad de los volúmenes antes del seed. `-SkipBuild` reutiliza imágenes existentes.

El navegador noVNC (`http://127.0.0.1:18450/vnc.html?autoconnect=1&resize=scale`) confía en una CA local dentro de su contenedor. No cambia la confianza del anfitrión ni desactiva TLS. La aplicación usa `https://localhost:18443`; API/Swagger directos en `http://127.0.0.1:18441/api/docs`. PostgreSQL solo escucha en loopback 55447 para la suite de integración.

Credenciales reservadas: admin@demo.example, owner.demo-norte@demo.example, member.demo-norte@demo.example, owner.demo-sur@demo.example y member.demo-sur@demo.example. Contraseña privada: `LOCAL_DEMO_PASSWORD` en el archivo externo `.local-avance2/core.env`. Nunca publicar ese archivo. El seed idempotente restaura las contraseñas de estas cuentas y agrega fixtures faltantes.

Parada sin pérdida: `docker compose -p prospector-avance2-core --env-file ../.local-avance2/core.env -f ops/avance2/compose.core.yml stop`. No usar `down -v`. Reinicio: mismo Start-Core con `-SkipBuild`. La imagen local del Frontend contiene loopback exclusivamente para pruebas: no publicarla en producción. El artefacto productivo se compila por separado con origen HTTPS público autorizado.

`verify-runtime.mjs ENV OUTPUT` prueba la API runtime reservada en puerto 18441. `verify-ui.mjs CONTAINER ENV OUTPUT` recorre cinco perfiles en la UI. Mantener rate limit activo: esperar al menos un minuto antes de repetir los cinco logins del mismo origen. Datos CSV son sintéticos y se enlazan al repetir para evitar duplicación.

JWT snapshot conserva permisos de rol/membresía hasta ocho horas: SEC-01 no implementa revocación dinámica. No hay migración P2 ni generación real en este core.
