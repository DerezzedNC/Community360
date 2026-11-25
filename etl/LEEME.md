# COMMUNITY 360 · ETL Fase 2

## 1. Preparar el entorno (una sola vez)
Usa Python 3.11 o 3.12 (el SDK de Couchbase puede no tener versión para la más reciente).

```
python -m venv .venv
.venv\Scripts\activate          # Windows   (en Mac/Linux: source .venv/bin/activate)
pip install -r requirements.txt
```

Copia `.env.example` como `.env` y llena tus datos de TiDB y Capella.
Los CSV originales van en la carpeta `datos/`.

## 2. Ejecutar
```
python etl.py --sin-carga        # etapas 1-7, prueba local sin tocar la nube
python etl.py --crear-esquema    # primera vez: crea las tablas y carga todo
python etl.py                    # siguientes veces: vuelve a cargar (no duplica)
```

Los archivos depurados quedan en `salida/`.

## 3. Evidencias
- Captura de la terminal con la ejecución completa.
- Captura de la carpeta `salida/`.
- TiDB Cloud → SQL Editor: consultas de `sql/02_consultas_evidencia.sql`.
- Capella → Data Tools → Query: consultas de `sql/03_consultas_capella.sql`.
