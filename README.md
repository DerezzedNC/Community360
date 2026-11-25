# COMMUNITY 360

Sistema web de análisis de una comunidad virtual con arquitectura híbrida en la nube: **TiDB Cloud** (SQL) + **Couchbase Capella** (NoSQL), API en **FastAPI** y dashboard en **React**.
Proyecto individual de Angel Gabriel Noh Camargo · Bases de Datos en la Nube · Unidad III.

## Estructura

```
cummunity360/
├── AGENTS.md              Reglas para todos los agentes (Claude Code y Antigravity)
├── CLAUDE.md              Rol de Claude Code (importa AGENTS.md)
├── .agents/               Rol y workflows de Antigravity (/tomar-tarea, /entregar-tarea)
├── .claude/commands/      Comandos de Claude Code (/tomar-tarea, /entregar-tarea)
├── docs/
│   ├── PLAN.md            Qué pide cada fase y quién la hace
│   ├── TAREAS.md          Tablero de tareas por equipo
│   ├── CONTRATO_API.md    Rutas, JSON, códigos HTTP y eventos WebSocket
│   ├── BITACORA.md        Registro de entregas entre equipos
│   └── especificacion/    PDF del proyecto y documentos de las fases 1 y 2
├── backend/               API FastAPI            → Claude Code   [CC]
├── frontend/              Dashboard React + Vite → Antigravity   [AG]
├── postman/               Colección para la demo → Claude Code   [CC]
├── evidencias/            Capturas por fase      → Antigravity   [AG]
└── etl/                   Script de la Fase 2 (entregado, no se modifica)
```

## Cómo trabajar con los dos equipos de agentes

1. Abre esta carpeta en Antigravity (File → Open Folder → `C:\cummunity360`).
2. **Claude Code:** en la terminal de Antigravity, dentro de esta carpeta, ejecuta `claude`. Al arrancar lee `CLAUDE.md`. Pídele `/tomar-tarea`.
3. **Agentes de Antigravity:** abre el Agent Manager y pídele `/tomar-tarea`. Leen `AGENTS.md` y `.agents/rules/` automáticamente.
4. Cada equipo trabaja en su carpeta. Se comunican por `docs/TAREAS.md`, `docs/BITACORA.md` y `docs/CONTRATO_API.md`.
5. Cuando una tarea termina, pide `/entregar-tarea` para que se marque y quede en la bitácora.

Al principio los dos pueden arrancar en paralelo: **F3-01** (Claude Code) y **F3-06** (Antigravity).

## Control de versiones (recomendado)

En la terminal, dentro de `C:\cummunity360`:

```
git init
git add .
git commit -m "Arranque del proyecto: reglas, plan y contrato"
```

Así puedes ver qué cambió cada agente y regresar si algo se rompe. `.gitignore` ya excluye `.env`, `node_modules`, `.venv` y `salida/`.

## Credenciales

`backend/.env` ya tiene las conexiones a TiDB y Capella y una clave para firmar los tokens. No se sube a git ni se pega en el documento. `backend/.env.example` muestra qué variables existen, sin valores.
