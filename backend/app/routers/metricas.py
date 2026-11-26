"""Indicadores del dashboard (contrato v0.8, definiciones en docs/INDICADORES.md). Solo lectura."""
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.repositorios import metricas as m

router = APIRouter(prefix="/api/metricas", tags=["métricas"])


def porcentaje(parte: int, total: int) -> float:
    return round(parte * 100 / total, 1) if total else 0.0


def redondear(valor: float | None) -> float | None:
    return None if valor is None else round(valor, 3)


def ahora_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


# --- Resumen -------------------------------------------------------------------------


class Resumen(BaseModel):
    usuarios: int
    usuarios_activos: int
    porcentaje_activos: float
    usuarios_con_consentimiento: int
    interacciones: int
    usuarios_que_interactuan: int
    sentimiento_promedio: float | None
    en_cuarentena: int
    generado_en: str


def calcular_resumen(tidb, capella) -> Resumen:
    """También lo usará el WebSocket de la Fase 5."""
    with tidb.conexion() as con:
        t = m.resumen_tidb(con)
    c = m.resumen_capella(capella)
    return Resumen(
        **t,
        porcentaje_activos=porcentaje(t["usuarios_activos"], t["usuarios"]),
        interacciones=c["interacciones"],
        usuarios_que_interactuan=c["usuarios_que_interactuan"],
        sentimiento_promedio=redondear(c["sentimiento_promedio"]),
        en_cuarentena=c["en_cuarentena"],
        generado_en=ahora_utc(),
    )


@router.get("/resumen")
def resumen(request: Request) -> Resumen:
    return calcular_resumen(request.app.state.tidb, request.app.state.capella)


# --- Estatus -------------------------------------------------------------------------


class FilaEstatus(BaseModel):
    estatus: str
    usuarios: int
    porcentaje: float


class Estatus(BaseModel):
    total: int
    datos: list[FilaEstatus]


@router.get("/estatus")
def estatus(request: Request) -> Estatus:
    with request.app.state.tidb.conexion() as con:
        conteo = m.usuarios_por_estatus(con)
    total = sum(conteo.values())
    datos = [
        FilaEstatus(estatus=e, usuarios=conteo.get(e, 0), porcentaje=porcentaje(conteo.get(e, 0), total))
        for e in m.ESTATUS
    ]
    return Estatus(total=total, datos=datos)


# --- Plataformas ---------------------------------------------------------------------


class FilaPlataforma(BaseModel):
    plataforma: str
    usuarios: int
    interacciones: int


class Plataformas(BaseModel):
    datos: list[FilaPlataforma]


@router.get("/plataformas")
def plataformas(request: Request) -> Plataformas:
    with request.app.state.tidb.conexion() as con:
        usuarios = m.usuarios_por_plataforma(con)
    interacciones = m.interacciones_por_canal(request.app.state.capella)
    codigos = sorted(set(usuarios) | set(interacciones))
    return Plataformas(datos=[
        FilaPlataforma(plataforma=c, usuarios=usuarios.get(c, 0), interacciones=interacciones.get(c, 0))
        for c in codigos
    ])


# --- Temas ---------------------------------------------------------------------------


class FilaTema(BaseModel):
    tema: str
    interacciones: int
    sentimiento_promedio: float | None


class Temas(BaseModel):
    datos: list[FilaTema]


@router.get("/temas")
def temas(request: Request) -> Temas:
    with request.app.state.tidb.conexion() as con:
        codigos = m.codigos_de_tema(con)
    por_tema = m.interacciones_por_tema(request.app.state.capella)
    datos = []
    for codigo in sorted(set(codigos) | set(por_tema)):
        fila = por_tema.get(codigo, {})
        datos.append(FilaTema(
            tema=codigo,
            interacciones=fila.get("interacciones", 0),
            sentimiento_promedio=redondear(fila.get("sentimiento_promedio")),
        ))
    return Temas(datos=datos)


# --- Tipos de interacción ------------------------------------------------------------


class FilaTipo(BaseModel):
    tipo: str
    nombre: str | None  # null si el código no está en el catálogo
    interacciones: int
    porcentaje: float


class Tipos(BaseModel):
    total: int
    datos: list[FilaTipo]


@router.get("/tipos")
def tipos(request: Request) -> Tipos:
    with request.app.state.tidb.conexion() as con:
        nombres = m.nombres_de_tipo(con)
    conteo = m.interacciones_por_tipo(request.app.state.capella)
    total = sum(conteo.values())
    return Tipos(total=total, datos=[
        FilaTipo(tipo=c, nombre=nombres.get(c), interacciones=conteo.get(c, 0),
                 porcentaje=porcentaje(conteo.get(c, 0), total))
        for c in sorted(set(nombres) | set(conteo))
    ])


# --- Etiquetas -----------------------------------------------------------------------

TOP_ETIQUETAS = 10


class FilaEtiqueta(BaseModel):
    etiqueta: str
    nombre: str | None
    interacciones: int


class Etiquetas(BaseModel):
    limite: int
    datos: list[FilaEtiqueta]


@router.get("/etiquetas")
def etiquetas(request: Request) -> Etiquetas:
    with request.app.state.tidb.conexion() as con:
        nombres = m.nombres_de_etiqueta(con)
    conteo = m.interacciones_por_etiqueta(request.app.state.capella)
    # De más a menos usadas; empate por código. Solo las que se usan al menos una vez.
    top = sorted(((c, n) for c, n in conteo.items() if n > 0), key=lambda x: (-x[1], x[0]))[:TOP_ETIQUETAS]
    return Etiquetas(limite=TOP_ETIQUETAS, datos=[
        FilaEtiqueta(etiqueta=c, nombre=nombres.get(c), interacciones=n) for c, n in top
    ])


# --- Actividad -----------------------------------------------------------------------


class Celda(BaseModel):
    dia_semana: int  # 1 = lunes ... 7 = domingo
    hora: int
    interacciones: int


class Actividad(BaseModel):
    zona_horaria: str
    datos: list[Celda]


@router.get("/actividad")
def actividad(request: Request) -> Actividad:
    conteo = {(d, h): 0 for d in range(1, 8) for h in range(24)}
    for marca in m.marcas_de_tiempo(request.app.state.capella):
        try:
            momento = datetime.strptime(marca, "%Y-%m-%dT%H:%M:%SZ")
        except (TypeError, ValueError):
            continue  # un documento sin timestamp válido no cuenta
        conteo[(momento.isoweekday(), momento.hour)] += 1
    return Actividad(
        zona_horaria="UTC",
        datos=[Celda(dia_semana=d, hora=h, interacciones=n) for (d, h), n in conteo.items()],
    )


# --- Geografía -----------------------------------------------------------------------


class FilaEstado(BaseModel):
    pais: str
    estado: str
    usuarios: int


class FilaCiudad(FilaEstado):
    ciudad: str


class Geografia(BaseModel):
    minimo_por_grupo: int
    usuarios_con_ubicacion: int
    estados: list[FilaEstado]
    ciudades: list[FilaCiudad]


def ocultar_grupos_chicos(ciudades: list[dict]) -> Geografia:
    """Agrega por estado y quita los grupos con menos de MINIMO_POR_GRUPO usuarios."""
    por_estado: dict[tuple[str, str], int] = {}
    for c in ciudades:
        clave = (c["pais"], c["estado"])
        por_estado[clave] = por_estado.get(clave, 0) + c["usuarios"]
    minimo = m.MINIMO_POR_GRUPO

    def orden(fila):
        return (-fila["usuarios"], fila["pais"], fila["estado"], fila.get("ciudad", ""))

    estados = [{"pais": p, "estado": e, "usuarios": n} for (p, e), n in por_estado.items() if n >= minimo]
    visibles = [c for c in ciudades if c["usuarios"] >= minimo]
    return Geografia(
        minimo_por_grupo=minimo,
        usuarios_con_ubicacion=sum(c["usuarios"] for c in ciudades),
        estados=sorted(estados, key=orden),
        ciudades=sorted(visibles, key=orden),
    )


@router.get("/geografia")
def geografia(request: Request) -> Geografia:
    with request.app.state.tidb.conexion() as con:
        return ocultar_grupos_chicos(m.usuarios_por_ciudad(con))


# --- Demografía ---------------------------------------------------------------------


class FilaRango(BaseModel):
    rango_edad: str
    descripcion: str | None
    usuarios: int
    porcentaje: float


class FilaInteres(BaseModel):
    interes: str
    nombre: str | None
    usuarios: int
    porcentaje: float


class FilaCruce(BaseModel):
    rango_edad: str
    interes: str
    usuarios: int


class Demografia(BaseModel):
    total: int
    rangos_edad: list[FilaRango]
    intereses: list[FilaInteres]
    cruce: list[FilaCruce]


def armar_demografia(rangos: dict[str, str], intereses: dict[str, str], filas: list[dict]) -> Demografia:
    total = sum(f["usuarios"] for f in filas)
    por_rango: dict[str, int] = {}
    por_interes: dict[str, int] = {}
    for f in filas:
        por_rango[f["cod_rango_edad"]] = por_rango.get(f["cod_rango_edad"], 0) + f["usuarios"]
        por_interes[f["cod_interes"]] = por_interes.get(f["cod_interes"], 0) + f["usuarios"]
    # Primero el orden del catálogo (de menor a mayor edad); al final, códigos fuera del catálogo
    orden_rangos = list(rangos) + sorted(set(por_rango) - set(rangos))
    return Demografia(
        total=total,
        rangos_edad=[FilaRango(rango_edad=c, descripcion=rangos.get(c), usuarios=por_rango.get(c, 0),
                               porcentaje=porcentaje(por_rango.get(c, 0), total)) for c in orden_rangos],
        intereses=[FilaInteres(interes=c, nombre=intereses.get(c), usuarios=por_interes.get(c, 0),
                               porcentaje=porcentaje(por_interes.get(c, 0), total))
                   for c in sorted(set(intereses) | set(por_interes))],
        cruce=[FilaCruce(rango_edad=f["cod_rango_edad"], interes=f["cod_interes"], usuarios=f["usuarios"])
               for f in sorted(filas, key=lambda f: (orden_rangos.index(f["cod_rango_edad"]), f["cod_interes"]))],
    )


@router.get("/demografia")
def demografia(request: Request) -> Demografia:
    with request.app.state.tidb.conexion() as con:
        return armar_demografia(m.rangos_de_edad(con), m.nombres_de_interes(con),
                                m.usuarios_por_edad_e_interes(con))


# --- Puntos calientes ----------------------------------------------------------------


class Cuadro(BaseModel):
    latitud_centro: float
    longitud_centro: float
    usuarios: int


class PuntosCalientes(BaseModel):
    tamano_cuadro: float
    minimo_por_cuadro: int
    usuarios_con_coordenadas: int
    usuarios_en_mapa: int
    datos: list[Cuadro]


def centro(cuadro: int) -> float:
    """Centro del cuadro número `cuadro`: va de cuadro×0.2 a (cuadro+1)×0.2."""
    paso = Decimal(m.TAMANO_CUADRO)
    return float(cuadro * paso + paso / 2)


def armar_mapa(cuadros: list[dict]) -> PuntosCalientes:
    """Quita los cuadros con menos de MINIMO_POR_GRUPO usuarios y devuelve solo su centro."""
    minimo = m.MINIMO_POR_GRUPO
    visibles = [c for c in cuadros if c["usuarios"] >= minimo]
    visibles.sort(key=lambda c: (-c["usuarios"], c["cuadro_lat"], c["cuadro_lon"]))
    return PuntosCalientes(
        tamano_cuadro=float(m.TAMANO_CUADRO),
        minimo_por_cuadro=minimo,
        usuarios_con_coordenadas=sum(c["usuarios"] for c in cuadros),
        usuarios_en_mapa=sum(c["usuarios"] for c in visibles),
        datos=[Cuadro(latitud_centro=centro(c["cuadro_lat"]), longitud_centro=centro(c["cuadro_lon"]),
                      usuarios=c["usuarios"]) for c in visibles],
    )


@router.get("/puntos-calientes")
def puntos_calientes(request: Request) -> PuntosCalientes:
    with request.app.state.tidb.conexion() as con:
        return armar_mapa(m.usuarios_por_cuadro(con))
