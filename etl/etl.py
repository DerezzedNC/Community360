"""
COMMUNITY 360 · Script de procesamiento ETL (Fase 2)

Ejecuta en orden las 8 etapas sobre los CSV originales:
  1. Eliminación de duplicados
  2. Normalización de vacíos y nulos
  3. Estandarización de fechas, categorías y formatos
  4. Validación de tipos de datos
  5. Verificación de referencias usuario ↔ interacción
  6. Eliminación de datos geográficos sin consentimiento
  7. Generación de archivos depurados
  8. Carga en la nube (TiDB Cloud + Couchbase Capella)

Uso:
  python etl.py                  # etapas 1-8
  python etl.py --sin-carga      # solo etapas 1-7 (no toca la nube)
  python etl.py --crear-esquema  # crea las tablas en TiDB antes de cargar
"""

import argparse
import hashlib
import json
import os
import re
import sys
import unicodedata
import uuid
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parent
DIR_DATOS = BASE / "datos"
DIR_SALIDA = BASE / "salida"
CSV_USUARIOS = DIR_DATOS / "comunidad_virtual_usuarios.csv"
CSV_INTERACCIONES = DIR_DATOS / "comunidad_virtual_interacciones_1000.csv"

# Fecha de corte del dataset: el estatus se calcula contra este día.
FECHA_CORTE = date(2026, 11, 9)
# Un conteo se marca como atípico si supera 3 veces el percentil 99.
FACTOR_ATIPICO = 3

VALORES_NULOS = {"", "na", "n/a", "null", "none", "nan", "-", "sin dato"}

# ---------------------------------------------------------------------
# Catálogos cerrados (código -> nombre). Lo que no esté aquí es inválido.
# ---------------------------------------------------------------------
CATALOGOS = {
    "rango_edad": {"18_24": "18-24", "25_31": "25-31", "32_38": "32-38", "39_mas": "39+"},
    "especie": {
        "zorro": "Zorro", "perro": "Perro", "lobo": "Lobo", "gato": "Gato",
        "hibrido_otro": "Híbrido/Otro", "dragon": "Dragón", "husky": "Husky",
        "coyote": "Coyote", "conejo": "Conejo", "reptil": "Reptil", "ave": "Ave", "tigre": "Tigre",
    },
    "interes": {
        "arte_digital": "Arte digital", "videojuegos": "Videojuegos", "convenciones": "Convenciones",
        "streaming_contenido": "Streaming/Contenido", "arte_tradicional": "Arte tradicional",
        "comics": "Cómics", "fursuit": "Fursuit", "musica": "Música",
        "escritura_historias": "Escritura/Historias", "cosplay": "Cosplay",
    },
    "plataforma": {
        "telegram": "Telegram", "facebook": "Facebook", "tiktok": "TikTok",
        "instagram": "Instagram", "twitter_x": "Twitter/X", "discord": "Discord",
    },
    "tema": {
        "arte_comisiones": "Arte y comisiones", "reglas_moderacion": "Reglas y moderación",
        "eventos_convenciones": "Eventos y convenciones", "videojuegos": "Videojuegos",
        "memes_humor": "Memes y humor", "fursuits": "Fursuits",
        "seguridad_privacidad": "Seguridad y privacidad", "musica": "Música",
    },
    "etiqueta": {
        "arte": "Arte", "aviso": "Aviso", "evento": "Evento", "humor": "Humor",
        "juegos": "Juegos", "musica": "Música", "reglas": "Reglas",
    },
    "tipo_interaccion": {
        "mensaje": "Mensaje", "comentario": "Comentario", "reaccion": "Reacción",
        "respuesta_encuesta": "Respuesta a encuesta", "rsvp_evento": "Confirmación a evento",
    },
    "dispositivo": {"android": "Android", "ios": "iOS", "web": "Web", "escritorio": "Escritorio"},
}
TIPOS_SIN_TEXTO = {"reaccion"}
IDIOMAS_VALIDOS = {"es", "en", "pt"}

REPORTE = {}  # Conteos de cada etapa; se exporta en la etapa 7.


# ---------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------
def titulo(n, texto):
    print(f"\n[{n}/8] {texto}")
    print("-" * 64)


def linea(etiqueta, valor):
    print(f"   {etiqueta:<52}{valor:>8}")


def a_codigo(valor):
    """'Twitter/X' -> 'twitter_x', 'Híbrido/Otro' -> 'hibrido_otro', '39+' -> '39_mas'."""
    if valor is None:
        return None
    s = unicodedata.normalize("NFKD", str(valor)).encode("ascii", "ignore").decode()
    s = s.lower().replace("+", "_mas")
    return re.sub(r"[^a-z0-9]+", "_", s).strip("_")


def es_nulo(v):
    return v is None or (isinstance(v, float) and pd.isna(v))


def huella(registro):
    texto = json.dumps(registro, sort_keys=True, ensure_ascii=False, default=str)
    return hashlib.sha1(texto.encode("utf-8")).hexdigest()[:16]


def sin_geo(registro):
    return {k: v for k, v in registro.items() if k not in ("pais", "estado", "ciudad", "latitud", "longitud", "zona_horaria")}


# ---------------------------------------------------------------------
# Etapa 1 · Duplicados
# ---------------------------------------------------------------------
def etapa1_duplicados(u, i, cuarentena):
    titulo(1, "Eliminación de registros duplicados")
    r = {"usuarios_leidos": len(u), "interacciones_leidas": len(i)}

    antes = len(u)
    u = u.drop_duplicates()
    r["usuarios_fila_identica"] = antes - len(u)

    antes = len(u)
    u = u.drop_duplicates(subset="id_usuario", keep="first")
    r["usuarios_id_repetido"] = antes - len(u)

    clave_alias = u["alias"].str.strip().str.lower()
    dup_alias = clave_alias.duplicated(keep="first")
    r["usuarios_alias_repetido"] = int(dup_alias.sum())
    u = u[~dup_alias]

    antes = len(i)
    i = i.drop_duplicates()
    r["interacciones_fila_identica"] = antes - len(i)

    dup_id = i["id_interaccion"].duplicated(keep="first")
    dup_contenido = i.duplicated(subset=["id_usuario", "timestamp", "tipo", "texto"], keep="first")
    dup = dup_id | dup_contenido
    for reg in i[dup].to_dict("records"):
        cuarentena.append((reg, ["duplicado"]))
    r["interacciones_id_o_contenido_repetido"] = int(dup.sum())
    i = i[~dup]

    for k, v in r.items():
        linea(k.replace("_", " "), v)
    REPORTE["1_duplicados"] = r
    return u.reset_index(drop=True), i.reset_index(drop=True)


# ---------------------------------------------------------------------
# Etapa 2 · Vacíos y nulos
# ---------------------------------------------------------------------
def etapa2_nulos(u, i):
    titulo(2, "Normalización de valores vacíos y nulos")
    r = {"usuarios": {}, "interacciones": {}}

    for nombre, df in (("usuarios", u), ("interacciones", i)):
        for col in df.columns:
            limpio = df[col].astype(str).str.strip()
            nulos = limpio.str.lower().isin(VALORES_NULOS)
            if nulos.any():
                r[nombre][col] = int(nulos.sum())
            df[col] = limpio.where(~nulos, None)

    # Reacciones: no llevan texto, así que tampoco longitud_texto.
    sin_texto = i["tipo"].str.lower().isin(TIPOS_SIN_TEXTO) | i["texto"].isna()
    corregidas = sin_texto & i["longitud_texto"].notna()
    r["longitud_texto_corregida_en_registros_sin_texto"] = int(corregidas.sum())
    i.loc[sin_texto, ["texto", "longitud_texto"]] = None
    u = u.astype(object).where(u.notna(), None)
    i = i.astype(object).where(i.notna(), None)

    for col, n in r["usuarios"].items():
        linea(f"usuarios · {col} vacío -> NULL", n)
    for col, n in r["interacciones"].items():
        linea(f"interacciones · {col} vacío -> NULL", n)
    linea("reacciones con longitud_texto inconsistente", r["longitud_texto_corregida_en_registros_sin_texto"])
    REPORTE["2_nulos"] = r
    return u, i


# ---------------------------------------------------------------------
# Etapa 3 · Estandarización
# ---------------------------------------------------------------------
def a_catalogo(valor, catalogo):
    """Devuelve el código del catálogo o None si el valor no pertenece."""
    if es_nulo(valor):
        return None
    cod = a_codigo(valor)
    if cod in CATALOGOS[catalogo]:
        return cod
    por_nombre = {a_codigo(n): c for c, n in CATALOGOS[catalogo].items()}
    return por_nombre.get(cod, "__invalido__")


def etapa3_estandarizar(u, i):
    titulo(3, "Estandarización de fechas, categorías y formatos")
    r = {}

    # Fechas dd/mm/aaaa -> fecha ISO
    for col in ("fecha_ingreso", "ultima_actividad"):
        u[col] = pd.to_datetime(u[col], format="%d/%m/%Y", errors="coerce").dt.date
    r["fechas_usuario_convertidas_a_iso"] = int(u["fecha_ingreso"].notna().sum() + u["ultima_actividad"].notna().sum())

    # Timestamps -> UTC ISO 8601
    ts = pd.to_datetime(i["timestamp"], utc=True, errors="coerce")
    i["timestamp"] = ts.dt.strftime("%Y-%m-%dT%H:%M:%SZ").where(ts.notna(), None)
    r["timestamps_homologados_utc"] = int(ts.notna().sum())

    # Categorías -> códigos de catálogo en minúsculas
    mapa_u = {"rango_edad": "rango_edad", "especie_fursona": "especie",
              "interes_principal": "interes", "plataforma_principal": "plataforma"}
    for col, cat in mapa_u.items():
        u[col] = u[col].map(lambda v, c=cat: a_catalogo(v, c))
    mapa_i = {"canal": "plataforma", "tipo": "tipo_interaccion", "tema": "tema", "dispositivo": "dispositivo"}
    for col, cat in mapa_i.items():
        i[col] = i[col].map(lambda v, c=cat: a_catalogo(v, c))
    r["categorias_convertidas_a_codigo"] = len(u) * len(mapa_u) + len(i) * len(mapa_i)

    # Booleanos de texto
    u["es_artista"] = u["es_artista"].map({"1": True, "0": False, "true": True, "false": False})
    u["consentimiento_datos"] = u["consentimiento_datos"].str.lower().map({"si": True, "sí": True, "no": False})
    u["estatus"] = u["estatus"].str.lower()
    i["idioma"] = i["idioma"].str.lower()

    # Campo multivaluado: 'humor|musica' -> ['humor', 'musica']
    def separar(v):
        if es_nulo(v):
            return []
        return sorted({a_catalogo(t, "etiqueta") for t in str(v).split("|") if t.strip()})
    i["etiquetas"] = i["etiquetas"].map(separar)
    r["interacciones_con_etiquetas_separadas"] = int((i["etiquetas"].str.len() > 0).sum())
    r["interacciones_sin_etiquetas_lista_vacia"] = int((i["etiquetas"].str.len() == 0).sum())

    for k, v in r.items():
        linea(k.replace("_", " "), v)
    REPORTE["3_estandarizacion"] = r
    return u, i


# ---------------------------------------------------------------------
# Etapa 4 · Validación de tipos
# ---------------------------------------------------------------------
def entero_no_negativo(v):
    return not es_nulo(v) and re.fullmatch(r"\d+", str(v)) is not None


def decimal_en_rango(v, lo, hi, opcional=False):
    if es_nulo(v):
        return opcional
    try:
        return lo <= float(v) <= hi
    except ValueError:
        return False


def etapa4_tipos(u, i, cuarentena):
    titulo(4, "Validación de tipos de datos")
    r = {}

    # --- Usuarios
    errores_u = []
    for _, f in u.iterrows():
        e = []
        if not re.fullmatch(r"U\d{6,9}", str(f.id_usuario)):
            e.append("id_usuario")
        if es_nulo(f.alias):
            e.append("alias")
        if es_nulo(f.fecha_ingreso) or es_nulo(f.ultima_actividad):
            e.append("fecha")
        elif f.ultima_actividad < f.fecha_ingreso:
            e.append("ultima_actividad<fecha_ingreso")
        for c in ("mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas"):
            if not entero_no_negativo(f[c]):
                e.append(c)
        if not decimal_en_rango(f.sentimiento_promedio, -1, 1, opcional=True):
            e.append("sentimiento_promedio")
        if not decimal_en_rango(f.latitud, -90, 90, opcional=True) or not decimal_en_rango(f.longitud, -180, 180, opcional=True):
            e.append("coordenadas")
        if es_nulo(f.latitud) != es_nulo(f.longitud):
            e.append("coordenada_incompleta")
        for c in ("rango_edad", "especie_fursona", "interes_principal", "plataforma_principal"):
            if f[c] in (None, "__invalido__"):
                e.append(c)
        if f.es_artista not in (True, False) or f.consentimiento_datos not in (True, False):
            e.append("booleano")
        if f.estatus not in ("activo", "en_riesgo", "inactivo"):
            e.append("estatus")
        errores_u.append(e)
    u["_errores"] = errores_u
    rechazados_u = u[u["_errores"].str.len() > 0].copy()
    u = u[u["_errores"].str.len() == 0].drop(columns="_errores").copy()

    # Conversión a tipos definitivos
    for c in ("mensajes_30d", "reacciones_30d", "eventos_asistidos", "comisiones_compradas"):
        u[c] = u[c].astype(int)
    for c in ("sentimiento_promedio", "latitud", "longitud"):
        u[c] = pd.to_numeric(u[c])

    # Conteos atípicos: se conservan pero se marcan
    u["es_atipico"] = False
    for c in ("mensajes_30d", "reacciones_30d"):
        limite = FACTOR_ATIPICO * u[c].quantile(0.99)
        u.loc[u[c] > limite, "es_atipico"] = True
    r["usuarios_validos"] = len(u)
    r["usuarios_rechazados_por_tipo"] = len(rechazados_u)
    r["usuarios_marcados_atipicos"] = int(u["es_atipico"].sum())

    # --- Interacciones
    validas = []
    rech_tipo = rech_cat = 0
    for reg in i.to_dict("records"):
        motivos = []
        if not re.fullmatch(r"I\d{7}", str(reg["id_interaccion"])) or not re.fullmatch(r"U\d{6,9}", str(reg["id_usuario"])):
            motivos.append("tipo_dato_invalido")
        if es_nulo(reg["timestamp"]) or not decimal_en_rango(reg["sentimiento"], -1, 1) \
                or not entero_no_negativo(reg["reacciones_recibidas"]) \
                or (not es_nulo(reg["longitud_texto"]) and not entero_no_negativo(reg["longitud_texto"])):
            motivos.append("tipo_dato_invalido")
        cats = [reg["canal"], reg["tipo"], reg["tema"], reg["dispositivo"], *reg["etiquetas"]]
        if any(c in (None, "__invalido__") for c in cats) or reg["idioma"] not in IDIOMAS_VALIDOS:
            motivos.append("categoria_invalida")
        if reg["tipo"] not in TIPOS_SIN_TEXTO and es_nulo(reg["texto"]):
            motivos.append("tipo_dato_invalido")
        motivos = sorted(set(motivos))
        if motivos:
            rech_tipo += "tipo_dato_invalido" in motivos
            rech_cat += "categoria_invalida" in motivos
            cuarentena.append((reg, motivos))
        else:
            reg["sentimiento"] = float(reg["sentimiento"])
            reg["reacciones_recibidas"] = int(reg["reacciones_recibidas"])
            reg["longitud_texto"] = None if es_nulo(reg["texto"]) else len(reg["texto"])
            validas.append(reg)
    r["interacciones_tipo_dato_invalido"] = rech_tipo
    r["interacciones_categoria_invalida"] = rech_cat
    r["interacciones_que_pasan_validacion"] = len(validas)

    for k, v in r.items():
        linea(k.replace("_", " "), v)
    REPORTE["4_tipos"] = r
    return u, validas, rechazados_u


# ---------------------------------------------------------------------
# Etapa 5 · Referencias usuario ↔ interacción
# ---------------------------------------------------------------------
def calcular_estatus(ultima):
    dias = (FECHA_CORTE - ultima).days
    if dias <= 14:
        return "activo"
    if dias <= 60:
        return "en_riesgo"
    return "inactivo"


def etapa5_referencias(u, interacciones, cuarentena):
    titulo(5, "Verificación de referencias usuarios ↔ interacciones")
    r = {}
    ingreso = dict(zip(u["id_usuario"], u["fecha_ingreso"]))
    validas, huerfanas, antes_ingreso = [], 0, 0
    ids_huerfanos = set()

    for reg in interacciones:
        dia = datetime.strptime(reg["timestamp"], "%Y-%m-%dT%H:%M:%SZ").date()
        if reg["id_usuario"] not in ingreso:
            huerfanas += 1
            ids_huerfanos.add(reg["id_usuario"])
            cuarentena.append((reg, ["usuario_inexistente"]))
        elif dia < ingreso[reg["id_usuario"]]:
            antes_ingreso += 1
            cuarentena.append((reg, ["fecha_anterior_ingreso"]))
        else:
            validas.append(reg)

    # ultima_actividad = máximo entre el padrón y la interacción válida más reciente
    ultima_int = {}
    for reg in validas:
        dia = datetime.strptime(reg["timestamp"], "%Y-%m-%dT%H:%M:%SZ").date()
        ultima_int[reg["id_usuario"]] = max(dia, ultima_int.get(reg["id_usuario"], dia))
    nueva = u.apply(lambda f: max(f.ultima_actividad,
                                  ultima_int.get(f.id_usuario, f.ultima_actividad)), axis=1)
    cambio_fecha = nueva != u["ultima_actividad"]
    u["ultima_actividad"] = nueva
    nuevo_estatus = u["ultima_actividad"].map(calcular_estatus)
    cambio_estatus = nuevo_estatus != u["estatus"]
    u["estatus"] = nuevo_estatus

    r["interacciones_huerfanas"] = huerfanas
    r["ids_de_usuario_inexistentes"] = len(ids_huerfanos)
    r["interacciones_anteriores_al_ingreso"] = antes_ingreso
    r["interacciones_validas"] = len(validas)
    r["usuarios_con_interacciones_validas"] = len(ultima_int)
    r["usuarios_con_ultima_actividad_actualizada"] = int(cambio_fecha.sum())
    r["usuarios_con_estatus_recalculado"] = int(cambio_estatus.sum())

    for k, v in r.items():
        linea(k.replace("_", " "), v)
    REPORTE["5_referencias"] = r
    return u, validas


# ---------------------------------------------------------------------
# Etapa 6 · Privacidad geográfica
# ---------------------------------------------------------------------
def etapa6_privacidad(u, interacciones, cuarentena):
    titulo(6, "Eliminación de datos geográficos sin consentimiento")
    r = {}
    geo_cols = ["pais", "estado", "ciudad", "zona_horaria", "latitud", "longitud"]
    sin_consent = ~u["consentimiento_datos"]
    con_algo = u.loc[sin_consent, geo_cols].notna().any(axis=1)
    r["usuarios_sin_consentimiento"] = int(sin_consent.sum())
    r["usuarios_sin_consentimiento_con_datos_geo_eliminados"] = int(con_algo.sum())
    u.loc[sin_consent, geo_cols] = None

    # Geografía de referencia: solo lugares de usuarios que sí autorizaron
    con = u[u["consentimiento_datos"] & u["ciudad"].notna()]
    geografia = con[["pais", "estado", "ciudad", "zona_horaria"]].drop_duplicates().sort_values(["pais", "estado", "ciudad"])
    ubicaciones = con[["id_usuario", "pais", "estado", "ciudad", "latitud", "longitud"]].copy()
    r["usuarios_con_ubicacion_autorizada"] = len(ubicaciones)
    r["ubicaciones_sin_coordenadas"] = int(ubicaciones["latitud"].isna().sum())

    # Las interacciones y la cuarentena no guardan geografía (se obtiene del usuario)
    con_geo = sum(1 for reg in interacciones if any(not es_nulo(reg.get(c)) for c in ("pais", "estado", "ciudad")))
    interacciones = [sin_geo(reg) for reg in interacciones]
    for n, (reg, motivos) in enumerate(cuarentena):
        cuarentena[n] = (sin_geo(reg), motivos)
    r["interacciones_con_geografia_removida"] = con_geo

    for k, v in r.items():
        linea(k.replace("_", " "), v)
    REPORTE["6_privacidad"] = r
    return u, interacciones, geografia, ubicaciones


# ---------------------------------------------------------------------
# Etapa 7 · Archivos depurados
# ---------------------------------------------------------------------
def etapa7_exportar(u, ubicaciones, geografia, interacciones, cuarentena, rechazados_u, lotes):
    titulo(7, "Generación de archivos depurados")
    DIR_SALIDA.mkdir(exist_ok=True)
    ahora = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    columnas_usuario = ["id_usuario", "alias", "fecha_ingreso", "rango_edad", "especie_fursona",
                        "interes_principal", "plataforma_principal", "es_artista", "mensajes_30d",
                        "reacciones_30d", "eventos_asistidos", "comisiones_compradas",
                        "sentimiento_promedio", "ultima_actividad", "estatus",
                        "consentimiento_datos", "es_atipico"]
    u[columnas_usuario].to_csv(DIR_SALIDA / "usuarios_depurados.csv", index=False)
    ubicaciones.to_csv(DIR_SALIDA / "ubicacion_usuario.csv", index=False)
    geografia.to_csv(DIR_SALIDA / "geografia.csv", index=False)
    rechazados_u.to_csv(DIR_SALIDA / "usuarios_rechazados.csv", index=False)

    docs_int = []
    for reg in interacciones:
        doc = {
            "_id": reg["id_interaccion"], "id_usuario": reg["id_usuario"],
            "timestamp": reg["timestamp"], "canal": reg["canal"], "tipo": reg["tipo"],
            "tema": reg["tema"], "sentimiento": reg["sentimiento"], "idioma": reg["idioma"],
            "dispositivo": reg["dispositivo"], "reacciones_recibidas": reg["reacciones_recibidas"],
            "etiquetas": reg["etiquetas"],
            "metadatos": {"origen": "csv", "id_lote": lotes["interacciones"], "creado_en": ahora},
        }
        if not es_nulo(reg["texto"]):  # el campo solo existe si hay texto
            doc["texto"] = reg["texto"]
            doc["longitud_texto"] = reg["longitud_texto"]
        docs_int.append(doc)

    docs_cua = []
    for reg, motivos in cuarentena:
        original = {k: (v if not isinstance(v, (date, datetime)) else str(v)) for k, v in reg.items()}
        docs_cua.append({
            "_id": "q_" + huella(original), "id_original": original.get("id_interaccion"),
            "registro": original, "motivos": motivos, "fuente": "csv",
            "id_lote": lotes["interacciones"], "detectado_en": ahora, "estado_revision": "pendiente",
        })

    with open(DIR_SALIDA / "interacciones_depuradas.json", "w", encoding="utf-8") as f:
        json.dump(docs_int, f, ensure_ascii=False, indent=2)
    with open(DIR_SALIDA / "cuarentena.json", "w", encoding="utf-8") as f:
        json.dump(docs_cua, f, ensure_ascii=False, indent=2)
    with open(DIR_SALIDA / "catalogos.json", "w", encoding="utf-8") as f:
        json.dump(CATALOGOS, f, ensure_ascii=False, indent=2)

    REPORTE["7_archivos"] = {"carpeta": str(DIR_SALIDA.name)}
    REPORTE["generado_en"] = ahora
    with open(DIR_SALIDA / "reporte_auditoria.json", "w", encoding="utf-8") as f:
        json.dump(REPORTE, f, ensure_ascii=False, indent=2, default=str)

    for archivo in sorted(DIR_SALIDA.iterdir()):
        linea(archivo.name, f"{archivo.stat().st_size / 1024:.1f} KB")
    return docs_int, docs_cua


# ---------------------------------------------------------------------
# Etapa 8 · Carga en la nube
# ---------------------------------------------------------------------
def conectar_tidb():
    import certifi
    import pymysql
    return pymysql.connect(
        host=os.environ["TIDB_HOST"], port=int(os.environ.get("TIDB_PORT", 4000)),
        user=os.environ["TIDB_USER"], password=os.environ["TIDB_PASSWORD"],
        database=os.environ.get("TIDB_DB", "community360"),
        ssl={"ca": certifi.where()}, ssl_verify_cert=True, ssl_verify_identity=True,
        autocommit=False, charset="utf8mb4",
    )


def crear_esquema():
    import certifi
    import pymysql
    print("\nCreando esquema en TiDB...")
    sql = (BASE / "sql" / "01_esquema_tidb.sql").read_text(encoding="utf-8")
    sentencias = [s.strip() for s in re.sub(r"--[^\n]*", "", sql).split(";") if s.strip()]
    con = pymysql.connect(
        host=os.environ["TIDB_HOST"], port=int(os.environ.get("TIDB_PORT", 4000)),
        user=os.environ["TIDB_USER"], password=os.environ["TIDB_PASSWORD"],
        ssl={"ca": certifi.where()}, ssl_verify_cert=True, ssl_verify_identity=True, autocommit=True,
    )
    with con.cursor() as cur:
        for s in sentencias:
            try:
                cur.execute(s)
            except pymysql.MySQLError as e:
                if s.upper().startswith("SET GLOBAL"):
                    print(f"   AVISO: no se pudo activar CHECK ({e.args[1]}). La validación queda en el ETL.")
                else:
                    raise
        cur.execute("SELECT @@global.tidb_enable_check_constraint")
        print(f"   CHECK constraints activos: {cur.fetchone()[0]}")
    con.close()
    print("   Esquema listo.")


def cargar_tidb(u, geografia, ubicaciones, lotes, conteos):
    print("   TiDB Cloud (SQL)")
    con = conectar_tidb()
    try:
        with con.cursor() as cur:
            # Catálogos
            for tabla, valores in CATALOGOS.items():
                if tabla == "rango_edad":
                    filas = [(c, n) for c, n in valores.items()]
                    cur.executemany("INSERT INTO rango_edad (codigo, descripcion) VALUES (%s,%s) "
                                    "ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion)", filas)
                elif tabla == "tipo_interaccion":
                    filas = [(c, n, c not in TIPOS_SIN_TEXTO) for c, n in valores.items()]
                    cur.executemany("INSERT INTO tipo_interaccion (codigo, nombre, admite_texto) VALUES (%s,%s,%s) "
                                    "ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), admite_texto=VALUES(admite_texto)", filas)
                else:
                    cur.executemany(f"INSERT INTO {tabla} (codigo, nombre) VALUES (%s,%s) "
                                    "ON DUPLICATE KEY UPDATE nombre=VALUES(nombre)", list(valores.items()))

            # Geografía
            for p in sorted(geografia["pais"].unique()):
                cur.execute("INSERT IGNORE INTO pais (nombre) VALUES (%s)", (p,))
            cur.execute("SELECT id_pais, nombre FROM pais")
            id_pais = {n: i for i, n in cur.fetchall()}
            for p, e in geografia[["pais", "estado"]].drop_duplicates().itertuples(index=False):
                cur.execute("INSERT IGNORE INTO estado (id_pais, nombre) VALUES (%s,%s)", (id_pais[p], e))
            cur.execute("SELECT e.id_estado, p.nombre, e.nombre FROM estado e JOIN pais p USING (id_pais)")
            id_estado = {(p, e): i for i, p, e in cur.fetchall()}
            for p, e, c, z in geografia.itertuples(index=False):
                cur.execute("INSERT INTO ciudad (id_estado, nombre, zona_horaria) VALUES (%s,%s,%s) "
                            "ON DUPLICATE KEY UPDATE zona_horaria=VALUES(zona_horaria)", (id_estado[(p, e)], c, z))
            cur.execute("SELECT c.id_ciudad, p.nombre, e.nombre, c.nombre FROM ciudad c "
                        "JOIN estado e USING (id_estado) JOIN pais p USING (id_pais)")
            id_ciudad = {(p, e, c): i for i, p, e, c in cur.fetchall()}

            # Usuarios
            filas = [(
                f.id_usuario, f.alias, f.fecha_ingreso, f.rango_edad, f.especie_fursona,
                f.interes_principal, f.plataforma_principal, bool(f.es_artista), int(f.mensajes_30d),
                int(f.reacciones_30d), int(f.eventos_asistidos), int(f.comisiones_compradas),
                None if pd.isna(f.sentimiento_promedio) else float(f.sentimiento_promedio),
                f.ultima_actividad, f.estatus, bool(f.consentimiento_datos), bool(f.es_atipico),
            ) for f in u.itertuples(index=False)]
            cur.executemany("""
                INSERT INTO usuario (id_usuario, alias, fecha_ingreso, cod_rango_edad, cod_especie,
                  cod_interes, cod_plataforma, es_artista, mensajes_30d, reacciones_30d,
                  eventos_asistidos, comisiones_compradas, sentimiento_promedio, ultima_actividad,
                  estatus, consentimiento_datos, es_atipico)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                ON DUPLICATE KEY UPDATE alias=VALUES(alias), fecha_ingreso=VALUES(fecha_ingreso),
                  cod_rango_edad=VALUES(cod_rango_edad), cod_especie=VALUES(cod_especie),
                  cod_interes=VALUES(cod_interes), cod_plataforma=VALUES(cod_plataforma),
                  es_artista=VALUES(es_artista), mensajes_30d=VALUES(mensajes_30d),
                  reacciones_30d=VALUES(reacciones_30d), eventos_asistidos=VALUES(eventos_asistidos),
                  comisiones_compradas=VALUES(comisiones_compradas),
                  sentimiento_promedio=VALUES(sentimiento_promedio), ultima_actividad=VALUES(ultima_actividad),
                  estatus=VALUES(estatus), consentimiento_datos=VALUES(consentimiento_datos),
                  es_atipico=VALUES(es_atipico)""", filas)

            # Ubicación: borrar la de quien no autoriza y cargar solo la autorizada
            sin = u.loc[~u["consentimiento_datos"], "id_usuario"].tolist()
            if sin:
                cur.executemany("DELETE FROM ubicacion_usuario WHERE id_usuario = %s", [(x,) for x in sin])
            filas = [(f.id_usuario, id_ciudad[(f.pais, f.estado, f.ciudad)],
                      None if pd.isna(f.latitud) else float(f.latitud),
                      None if pd.isna(f.longitud) else float(f.longitud))
                     for f in ubicaciones.itertuples(index=False)]
            cur.executemany("INSERT INTO ubicacion_usuario (id_usuario, id_ciudad, latitud, longitud) "
                            "VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE id_ciudad=VALUES(id_ciudad), "
                            "latitud=VALUES(latitud), longitud=VALUES(longitud)", filas)

            # Bitácora de la ejecución (una fila por archivo)
            for tipo, c in conteos.items():
                cur.execute("""INSERT INTO bitacora_carga (id_lote, archivo, tipo_archivo, recibidos,
                               aceptados, rechazados, transformados, anonimizados, observaciones)
                               VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                            (lotes[tipo], c["archivo"], tipo, c["recibidos"], c["aceptados"],
                             c["rechazados"], c["transformados"], c["anonimizados"], c["observaciones"]))
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()
    linea("usuarios cargados", len(u))
    linea("ubicaciones cargadas", len(ubicaciones))


def conectar_couchbase():
    from datetime import timedelta
    from couchbase.auth import PasswordAuthenticator
    from couchbase.cluster import Cluster
    from couchbase.options import ClusterOptions
    opciones = ClusterOptions(PasswordAuthenticator(os.environ["CB_USER"], os.environ["CB_PASSWORD"]))
    opciones.apply_profile("wan_development")
    cluster = Cluster(os.environ["CB_CONN"], opciones)
    cluster.wait_until_ready(timedelta(seconds=20))
    return cluster


def cargar_couchbase(docs_int, docs_cua):
    print("   Couchbase Capella (NoSQL)")
    cluster = conectar_couchbase()
    bucket = os.environ.get("CB_BUCKET", "community360")
    scope = cluster.bucket(bucket).scope(os.environ.get("CB_SCOPE", "app"))
    ruta = f"`{bucket}`.`{os.environ.get('CB_SCOPE', 'app')}`"

    indices = [
        f"CREATE PRIMARY INDEX IF NOT EXISTS ON {ruta}.interacciones",
        f"CREATE PRIMARY INDEX IF NOT EXISTS ON {ruta}.cuarentena",
        f"CREATE INDEX IF NOT EXISTS idx_int_usuario ON {ruta}.interacciones(id_usuario)",
        f"CREATE INDEX IF NOT EXISTS idx_int_timestamp ON {ruta}.interacciones(`timestamp`)",
        f"CREATE INDEX IF NOT EXISTS idx_int_tema ON {ruta}.interacciones(tema)",
        f"CREATE INDEX IF NOT EXISTS idx_cua_motivos ON {ruta}.cuarentena(DISTINCT ARRAY m FOR m IN motivos END)",
        f"CREATE INDEX IF NOT EXISTS idx_cua_lote ON {ruta}.cuarentena(id_lote)",
    ]
    for q in indices:
        cluster.query(q).execute()

    for nombre, docs in (("interacciones", docs_int), ("cuarentena", docs_cua)):
        coleccion = scope.collection(nombre)
        for d in docs:
            cuerpo = {k: v for k, v in d.items() if k != "_id"}
            coleccion.upsert(d["_id"], cuerpo)
        linea(f"documentos en {nombre}", len(docs))


def verificar(cluster_cb=None):
    print("\nVerificación en la nube")
    print("-" * 64)
    con = conectar_tidb()
    with con.cursor() as cur:
        for t in ("usuario", "ubicacion_usuario", "pais", "estado", "ciudad", "bitacora_carga"):
            cur.execute(f"SELECT COUNT(*) FROM {t}")
            linea(f"TiDB · {t}", cur.fetchone()[0])
        cur.execute("""SELECT COUNT(*) FROM usuario u JOIN ubicacion_usuario x USING (id_usuario)
                       WHERE u.consentimiento_datos = FALSE""")
        linea("usuarios SIN consentimiento con datos geográficos", cur.fetchone()[0])
    con.close()
    cluster = conectar_couchbase()
    bucket = os.environ.get("CB_BUCKET", "community360")
    ruta = f"`{bucket}`.`{os.environ.get('CB_SCOPE', 'app')}`"
    for col in ("interacciones", "cuarentena"):
        fila = next(iter(cluster.query(f"SELECT COUNT(*) AS n FROM {ruta}.{col}").rows()))
        linea(f"Capella · {col}", fila["n"])


def etapa8_cargar(u, geografia, ubicaciones, docs_int, docs_cua, lotes, conteos):
    titulo(8, "Carga de registros válidos en la nube")
    cargar_tidb(u, geografia, ubicaciones, lotes, conteos)
    cargar_couchbase(docs_int, docs_cua)
    verificar()


# ---------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="ETL COMMUNITY 360")
    parser.add_argument("--sin-carga", action="store_true", help="ejecuta solo las etapas 1 a 7")
    parser.add_argument("--crear-esquema", action="store_true", help="crea las tablas en TiDB antes de cargar")
    args = parser.parse_args()

    if not args.sin_carga:
        try:
            from dotenv import load_dotenv
            load_dotenv(BASE / ".env")
        except ImportError:
            pass
        faltan = [v for v in ("TIDB_HOST", "TIDB_USER", "TIDB_PASSWORD", "CB_CONN", "CB_USER", "CB_PASSWORD")
                  if not os.environ.get(v)]
        if faltan:
            sys.exit(f"Faltan variables en .env: {', '.join(faltan)}")

    print("=" * 64)
    print(" COMMUNITY 360 · ETL Fase 2")
    print(f" Inicio: {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("=" * 64)

    u = pd.read_csv(CSV_USUARIOS, dtype=str, keep_default_na=False)
    i = pd.read_csv(CSV_INTERACCIONES, dtype=str, keep_default_na=False)
    lotes = {"usuarios": str(uuid.uuid4()), "interacciones": str(uuid.uuid4())}
    cuarentena = []
    recibidos_u, recibidos_i = len(u), len(i)

    u, i = etapa1_duplicados(u, i, cuarentena)
    u, i = etapa2_nulos(u, i)
    u, i = etapa3_estandarizar(u, i)
    u, interacciones, rechazados_u = etapa4_tipos(u, i, cuarentena)
    u, interacciones = etapa5_referencias(u, interacciones, cuarentena)
    u, interacciones, geografia, ubicaciones = etapa6_privacidad(u, interacciones, cuarentena)
    docs_int, docs_cua = etapa7_exportar(u, ubicaciones, geografia, interacciones, cuarentena, rechazados_u, lotes)

    r = REPORTE
    conteos = {
        "usuarios": {
            "archivo": CSV_USUARIOS.name, "recibidos": recibidos_u, "aceptados": len(u),
            "rechazados": recibidos_u - len(u),
            "transformados": r["5_referencias"]["usuarios_con_ultima_actividad_actualizada"],
            "anonimizados": r["6_privacidad"]["usuarios_sin_consentimiento_con_datos_geo_eliminados"],
            "observaciones": f"{r['4_tipos']['usuarios_marcados_atipicos']} usuarios marcados como atípicos",
        },
        "interacciones": {
            "archivo": CSV_INTERACCIONES.name, "recibidos": recibidos_i, "aceptados": len(docs_int),
            "rechazados": len(docs_cua),
            "transformados": r["2_nulos"]["longitud_texto_corregida_en_registros_sin_texto"],
            "anonimizados": r["6_privacidad"]["interacciones_con_geografia_removida"],
            "observaciones": f"{r['5_referencias']['interacciones_huerfanas']} huérfanas enviadas a cuarentena",
        },
    }
    assert conteos["interacciones"]["aceptados"] + conteos["interacciones"]["rechazados"] == recibidos_i

    if args.sin_carga:
        print("\n[8/8] Carga omitida (--sin-carga)")
    else:
        if args.crear_esquema:
            crear_esquema()
        etapa8_cargar(u, geografia, ubicaciones, docs_int, docs_cua, lotes, conteos)

    print("\n" + "=" * 64)
    print(f" Usuarios:      {recibidos_u} leídos -> {len(u)} cargables")
    print(f" Interacciones: {recibidos_i} leídas -> {len(docs_int)} válidas, {len(docs_cua)} en cuarentena")
    print(f" Fin: {datetime.now():%Y-%m-%d %H:%M:%S}")
    print("=" * 64)


if __name__ == "__main__":
    main()
