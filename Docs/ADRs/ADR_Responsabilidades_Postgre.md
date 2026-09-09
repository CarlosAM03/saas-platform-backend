# ADR-XXX — Responsabilidad de PostgreSQL, Persistencia y Aislamiento Multi-Tenant

## Estado

**Aceptado**

## Fecha

Agosto 2026

## Contexto

El sistema propuesto es una plataforma SaaS de prospección y gestión de campañas de marketing digital con arquitectura multi-tenant.

La plataforma está compuesta conceptualmente por:

```text
Flutter
   │
   ▼
SaaS Backend
   │
   ▼
Prospector Service
   │
   ▼
Prospector Engine
   │
   ├── Google Maps
   └── Websites
```

PostgreSQL constituye el sistema principal de persistencia de la plataforma.

La plataforma utilizará inicialmente una estrategia de:

```text
Shared Database
        +
Shared Schema
        +
Tenant ID
```

Debido a que múltiples empresas compartirán la misma base de datos y esquema, el aislamiento de la información entre tenants constituye una responsabilidad crítica del diseño.

No se considera suficiente depender de una única capa para garantizar dicho aislamiento. Se adoptará una estrategia de **defensa en profundidad**, donde tanto el SaaS Backend como PostgreSQL participen en la protección de los datos multi-tenant.

---

# Decisión

PostgreSQL será el **sistema principal de persistencia de la plataforma SaaS**.

La responsabilidad sobre el aislamiento multi-tenant será **compartida entre la capa de aplicación y la capa de persistencia**.

La arquitectura utilizará:

```text
Shared Database
        │
        ▼
Shared Schema
        │
        ▼
Tenant ID
        │
        ├───────────────┐
        ▼               ▼
SaaS Backend       PostgreSQL
        │               │
        └───────┬───────┘
                ▼
        Aislamiento lógico
```

El **SaaS Backend** será responsable de establecer y validar el contexto del tenant, mientras PostgreSQL proporcionará mecanismos de persistencia e integridad que refuercen la separación de los datos.

El aislamiento no deberá depender exclusivamente de que el código de aplicación filtre correctamente cada consulta.

---

# Responsabilidad de PostgreSQL

PostgreSQL será responsable de:

* persistir la información de la plataforma;
* mantener la estructura relacional;
* mantener integridad referencial;
* aplicar restricciones definidas en el modelo;
* ejecutar transacciones;
* almacenar relaciones entre entidades;
* soportar la estrategia Shared Database + Shared Schema;
* conservar el identificador de tenant en las entidades que correspondan;
* proporcionar mecanismos de protección de datos que permitan reforzar el aislamiento multi-tenant.

PostgreSQL **no será responsable de definir las reglas de negocio de la plataforma**.

---

# Responsabilidad del SaaS Backend

El SaaS Backend será responsable de:

* autenticar las solicitudes;
* identificar al usuario;
* determinar el tenant correspondiente;
* validar autorización;
* establecer el contexto de tenant;
* aplicar reglas de negocio;
* construir y ejecutar las operaciones de persistencia;
* asegurar que las operaciones correspondan al tenant autorizado;
* evitar que una operación de negocio acceda intencionalmente a información de otro tenant.

Conceptualmente:

```text
Request
   │
   ▼
Authentication
   │
   ▼
User
   │
   ▼
Tenant Context
   │
   ▼
Authorization
   │
   ▼
Business Logic
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
```

---

# Aislamiento Multi-Tenant

El aislamiento será implementado mediante una estrategia de **defensa en profundidad**.

```text
┌────────────────────────────────────┐
│ SaaS Backend                       │
│                                    │
│ Identidad                          │
│ Tenant Context                     │
│ Autorización                       │
│ Reglas de negocio                  │
│ Filtrado de operaciones            │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│ Prisma ORM                         │
│                                    │
│ Acceso controlado al modelo        │
└──────────────────┬─────────────────┘
                   │
                   ▼
┌────────────────────────────────────┐
│ PostgreSQL                         │
│                                    │
│ tenant_id                          │
│ Relaciones                         │
│ Constraints                        │
│ Integridad                         │
│ Mecanismos DB de aislamiento       │
└────────────────────────────────────┘
```

El Backend constituye la **primera capa de control**, mientras PostgreSQL proporciona una **segunda capa de protección**.

El objetivo es reducir el riesgo de exposición accidental de información entre tenants.

---

# Estrategia Shared Database + Shared Schema + Tenant ID

Todos los tenants utilizarán la misma base de datos y el mismo esquema.

Conceptualmente:

```text
                    PostgreSQL
                         │
                Shared Database
                         │
                 Shared Schema
                         │
          ┌──────────────┴──────────────┐
          │                             │
      tenant_id = A                 tenant_id = B
          │                             │
       Usuarios                      Usuarios
       Campañas                      Campañas
       Prospectos                    Prospectos
```

Las entidades multi-tenant deberán incluir la información necesaria para determinar a qué tenant pertenecen.

Las consultas realizadas desde el Backend deberán operar dentro del contexto de tenant correspondiente.

PostgreSQL podrá reforzar esta separación mediante mecanismos propios de la base de datos que sean definidos durante la implementación.

---

# Prisma ORM

Prisma será utilizado como capa ORM entre el SaaS Backend y PostgreSQL.

La relación será:

```text
SaaS Backend
      │
      ▼
Prisma ORM
      │
      ▼
PostgreSQL
```

Prisma facilitará:

* acceso tipado al modelo;
* consultas;
* relaciones;
* migraciones;
* operaciones transaccionales;
* interacción con PostgreSQL.

Prisma no reemplaza las reglas de autorización ni la responsabilidad del Backend sobre el contexto de tenant.

---

# Responsabilidad del Prospector Service

Prospector Service será responsable de exponer y orquestar la capacidad de prospección.

Su flujo será:

```text
HTTP Request
      │
      ▼
DTO
      │
      ▼
Validation
      │
      ▼
Service Orchestration
      │
      ▼
Prospector Engine
      │
      ▼
Business[]
```

El Prospector Service no será responsable del dominio completo de tenants, usuarios, campañas o autorización de la plataforma.

---

# Responsabilidad del Prospector Engine

El Prospector Engine será responsable de:

* extracción;
* enriquecimiento;
* normalización;
* deduplicación;
* generación de resultados de prospección.

El Engine no será responsable de:

* tenants;
* usuarios;
* roles;
* permisos;
* campañas;
* autenticación;
* autorización;
* persistencia de negocio de la plataforma.

El Engine trabaja con resultados de prospección y entrega información estructurada a su consumidor.

---

# Flujo de persistencia

Una ejecución completa podrá seguir el siguiente flujo:

```text
Usuario
   │
   ▼
Flutter
   │
   ▼
SaaS Backend
   │
   ├── Identidad
   ├── Tenant
   ├── Autorización
   └── Reglas de negocio
   │
   ▼
Prospector Service
   │
   ▼
Prospector Engine
   │
   ├── Google Maps
   ├── Extraction
   ├── Enrichment
   ├── Normalization
   └── Deduplication
   │
   ▼
Resultados
   │
   ▼
SaaS Backend
   │
   ├── Contexto del tenant
   ├── Reglas de negocio
   └── Asociación con campaña
   │
   ▼
Prisma
   │
   ▼
PostgreSQL
   │
   ├── tenant_id
   ├── Integridad
   └── Protección de persistencia
```

La persistencia de los resultados será responsabilidad de la plataforma y no del Engine.

---

# Defensa en profundidad

El aislamiento multi-tenant se diseñará considerando dos niveles:

## Nivel 1 — Aplicación

El Backend debe:

* conocer el tenant de la operación;
* validar que el usuario tenga acceso;
* mantener el contexto de tenant;
* aplicar filtros y reglas de autorización;
* impedir operaciones fuera del tenant autorizado.

## Nivel 2 — Persistencia

PostgreSQL deberá proporcionar mecanismos adicionales para reforzar el aislamiento.

La implementación concreta de estos mecanismos podrá definirse durante el desarrollo, sin comprometer todavía una tecnología específica de aislamiento a nivel de base de datos.

La intención es:

```text
Si la aplicación comete un error
          │
          ▼
La capa de persistencia proporciona
una segunda barrera de protección
```

Esto constituye una estrategia de **defensa en profundidad**.

---

# Qué no hará PostgreSQL

PostgreSQL no será responsable de:

* ejecutar scraping;
* controlar Playwright;
* navegar Google Maps;
* extraer información de websites;
* realizar enriquecimiento web;
* ejecutar la lógica del Prospector Engine;
* definir campañas;
* autenticar usuarios;
* administrar la interfaz;
* implementar la lógica de negocio del SaaS.

Su responsabilidad será la **persistencia, integridad y refuerzo del aislamiento de los datos**.

---

# Decisiones que permanecen abiertas

Este ADR no define todavía:

* modelo completo de tablas;
* nombres definitivos de entidades;
* estructura definitiva de `Business` dentro de la plataforma;
* estrategia exacta de índices;
* mecanismo específico de aislamiento a nivel PostgreSQL;
* uso o no de Row-Level Security;
* política definitiva de eliminación de datos;
* retención histórica;
* auditoría;
* particionamiento;
* replicación;
* alta disponibilidad;
* estrategia de backups;
* escalamiento de la base de datos.

Estas decisiones podrán documentarse mediante ADRs adicionales cuando sean necesarias.

---

# Consecuencias positivas

La decisión permite:

* mantener una arquitectura multi-tenant centralizada;
* evitar bases de datos independientes por tenant;
* separar negocio y persistencia;
* reforzar el aislamiento mediante múltiples capas;
* reducir el impacto de errores de aplicación;
* mantener el Engine independiente del dominio SaaS;
* utilizar Prisma como capa ORM;
* facilitar la evolución futura del sistema.

---

# Riesgos

La estrategia Shared Database + Shared Schema requiere especial cuidado debido a que los datos de múltiples tenants coexistirán físicamente en la misma base de datos.

Un error de configuración o implementación podría provocar exposición cruzada de información.

Por ello, el aislamiento deberá probarse explícitamente durante el desarrollo.

Se deberán considerar pruebas como:

```text
Tenant A
   │
   ├── puede consultar sus datos
   ├── puede modificar sus datos
   └── NO puede consultar datos de Tenant B

Tenant B
   │
   ├── puede consultar sus datos
   ├── puede modificar sus datos
   └── NO puede consultar datos de Tenant A
```

---

# Relación entre componentes

| Componente         | Responsabilidad                                                          |
| ------------------ | ------------------------------------------------------------------------ |
| Flutter            | Interfaz y experiencia del usuario                                       |
| SaaS Backend       | Dominio, lógica de negocio, identidad, autorización y contexto de tenant |
| Prospector Service | API, DTOs, validación y orquestación                                     |
| Prospector Engine  | Extracción, enriquecimiento, normalización y deduplicación               |
| Prisma             | Acceso ORM al modelo relacional                                          |
| PostgreSQL         | Persistencia, integridad y refuerzo del aislamiento                      |

La arquitectura completa queda:

```text
                    Flutter
                       │
                       ▼
                SaaS Backend
                       │
             ┌─────────┴─────────┐
             │                   │
        Lógica de negocio    Prisma ORM
             │                   │
             ▼                   ▼
     Prospector Service     PostgreSQL
             │             ▲
             ▼             │
      Prospector Engine ───┘
             │
       ┌─────┴─────┐
       ▼           ▼
  Google Maps   Websites
```

---

# Principio arquitectónico

La arquitectura seguirá el siguiente principio:

> **El SaaS Backend administra el negocio y establece el contexto del tenant; Prospector Service administra la ejecución de la capacidad de prospección; Prospector Engine ejecuta la extracción y enriquecimiento; Prisma proporciona el acceso ORM; y PostgreSQL persiste los datos y refuerza su aislamiento.**

El aislamiento multi-tenant se considera una responsabilidad de **defensa en profundidad**, donde la aplicación y la base de datos colaboran para proteger la información de cada tenant.
