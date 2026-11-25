-- =====================================================================
-- COMMUNITY 360 · Esquema relacional (TiDB Cloud Starter) · modelo v3
-- Ejecutar una sola vez en el SQL Editor de TiDB Cloud (o con el script
-- etl.py --crear-esquema). Es seguro repetirlo: usa IF NOT EXISTS.
-- =====================================================================

-- TiDB trae los CHECK apagados por defecto. Sin esta línea las
-- restricciones CHECK se aceptan pero no se aplican.
SET GLOBAL tidb_enable_check_constraint = ON;

CREATE DATABASE IF NOT EXISTS community360
  DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE community360;

-- ---------------------------------------------------------------------
-- Catálogos (llave natural en minúsculas, compartida con NoSQL)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rango_edad (
  codigo      VARCHAR(10) NOT NULL PRIMARY KEY,
  descripcion VARCHAR(30) NOT NULL UNIQUE,
  activo      BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_rango_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS especie (
  codigo VARCHAR(20) NOT NULL PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  activo BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_especie_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS interes (
  codigo VARCHAR(30) NOT NULL PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE,
  activo BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_interes_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS plataforma (
  codigo VARCHAR(20) NOT NULL PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  activo BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_plataforma_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS tema (
  codigo VARCHAR(30) NOT NULL PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE,
  activo BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_tema_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS etiqueta (
  codigo VARCHAR(20) NOT NULL PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  activo BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_etiqueta_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS tipo_interaccion (
  codigo       VARCHAR(25) NOT NULL PRIMARY KEY,
  nombre       VARCHAR(40) NOT NULL UNIQUE,
  admite_texto BOOLEAN     NOT NULL,
  activo       BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_tipo_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

CREATE TABLE IF NOT EXISTS dispositivo (
  codigo VARCHAR(20) NOT NULL PRIMARY KEY,
  nombre VARCHAR(30) NOT NULL UNIQUE,
  activo BOOLEAN     NOT NULL DEFAULT TRUE,
  CONSTRAINT chk_dispositivo_codigo CHECK (codigo REGEXP '^[a-z0-9_]+$')
);

-- ---------------------------------------------------------------------
-- Geografía en tres niveles
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pais (
  id_pais INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  nombre  VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS estado (
  id_estado INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_pais   INT         NOT NULL,
  nombre    VARCHAR(60) NOT NULL,
  CONSTRAINT uq_estado UNIQUE (id_pais, nombre),
  CONSTRAINT fk_estado_pais FOREIGN KEY (id_pais)
    REFERENCES pais (id_pais) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS ciudad (
  id_ciudad    INT         NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_estado    INT         NOT NULL,
  nombre       VARCHAR(60) NOT NULL,
  zona_horaria VARCHAR(40) NOT NULL,
  CONSTRAINT uq_ciudad UNIQUE (id_estado, nombre),
  CONSTRAINT fk_ciudad_estado FOREIGN KEY (id_estado)
    REFERENCES estado (id_estado) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------
-- Padrón de usuarios
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario (
  id_usuario           VARCHAR(10)  NOT NULL PRIMARY KEY,
  alias                VARCHAR(40)  NOT NULL UNIQUE,
  fecha_ingreso        DATE         NOT NULL,
  cod_rango_edad       VARCHAR(10)  NOT NULL,
  cod_especie          VARCHAR(20)  NOT NULL,
  cod_interes          VARCHAR(30)  NOT NULL,
  cod_plataforma       VARCHAR(20)  NOT NULL,
  es_artista           BOOLEAN      NOT NULL DEFAULT FALSE,
  mensajes_30d         INT          NOT NULL DEFAULT 0,
  reacciones_30d       INT          NOT NULL DEFAULT 0,
  eventos_asistidos    INT          NOT NULL DEFAULT 0,
  comisiones_compradas INT          NOT NULL DEFAULT 0,
  sentimiento_promedio DECIMAL(4,3) NULL,
  ultima_actividad     DATE         NOT NULL,
  estatus              VARCHAR(10)  NOT NULL,
  consentimiento_datos BOOLEAN      NOT NULL DEFAULT FALSE,
  es_atipico           BOOLEAN      NOT NULL DEFAULT FALSE,
  creado_en            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en       TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT chk_usuario_id      CHECK (id_usuario REGEXP '^U[0-9]{6,9}$'),
  CONSTRAINT chk_usuario_alias   CHECK (CHAR_LENGTH(TRIM(alias)) > 0),
  CONSTRAINT chk_usuario_conteos CHECK (mensajes_30d >= 0 AND reacciones_30d >= 0
                                        AND eventos_asistidos >= 0 AND comisiones_compradas >= 0),
  CONSTRAINT chk_usuario_sent    CHECK (sentimiento_promedio IS NULL OR sentimiento_promedio BETWEEN -1 AND 1),
  CONSTRAINT chk_usuario_fechas  CHECK (ultima_actividad >= fecha_ingreso),
  CONSTRAINT chk_usuario_estatus CHECK (estatus IN ('activo', 'en_riesgo', 'inactivo')),
  INDEX idx_usuario_estatus (estatus),
  INDEX idx_usuario_ultima (ultima_actividad),
  INDEX idx_usuario_plataforma (cod_plataforma),
  CONSTRAINT fk_usuario_rango FOREIGN KEY (cod_rango_edad) REFERENCES rango_edad (codigo) ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_especie FOREIGN KEY (cod_especie) REFERENCES especie (codigo) ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_interes FOREIGN KEY (cod_interes) REFERENCES interes (codigo) ON DELETE RESTRICT,
  CONSTRAINT fk_usuario_plataforma FOREIGN KEY (cod_plataforma) REFERENCES plataforma (codigo) ON DELETE RESTRICT
);

-- Solo existe fila para usuarios con consentimiento_datos = TRUE.
-- TiDB no tiene triggers: esta regla la garantiza el ETL / la API.
CREATE TABLE IF NOT EXISTS ubicacion_usuario (
  id_usuario VARCHAR(10)  NOT NULL PRIMARY KEY,
  id_ciudad  INT          NOT NULL,
  latitud    DECIMAL(9,6) NULL,
  longitud   DECIMAL(9,6) NULL,
  CONSTRAINT chk_ubic_lat  CHECK (latitud IS NULL OR latitud BETWEEN -90 AND 90),
  CONSTRAINT chk_ubic_lon  CHECK (longitud IS NULL OR longitud BETWEEN -180 AND 180),
  CONSTRAINT chk_ubic_par  CHECK ((latitud IS NULL) = (longitud IS NULL)),
  CONSTRAINT fk_ubic_usuario FOREIGN KEY (id_usuario) REFERENCES usuario (id_usuario) ON DELETE CASCADE,
  CONSTRAINT fk_ubic_ciudad FOREIGN KEY (id_ciudad) REFERENCES ciudad (id_ciudad) ON DELETE RESTRICT
);

-- ---------------------------------------------------------------------
-- Cuentas del dashboard y bitácora de cargas
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuario_admin (
  id_admin      INT          NOT NULL AUTO_INCREMENT PRIMARY KEY,
  correo        VARCHAR(120) NOT NULL UNIQUE,
  nombre        VARCHAR(80)  NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  rol           VARCHAR(15)  NOT NULL,
  activo        BOOLEAN      NOT NULL DEFAULT TRUE,
  creado_en     TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ultimo_acceso TIMESTAMP    NULL,
  CONSTRAINT chk_admin_correo CHECK (correo LIKE '%_@_%._%'),
  CONSTRAINT chk_admin_rol    CHECK (rol IN ('admin', 'analista'))
);

CREATE TABLE IF NOT EXISTS bitacora_carga (
  id_lote       CHAR(36)    NOT NULL PRIMARY KEY,
  id_admin      INT         NULL,
  archivo       VARCHAR(80) NOT NULL,
  tipo_archivo  VARCHAR(15) NOT NULL,
  ejecutado_en  TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  recibidos     INT         NOT NULL,
  aceptados     INT         NOT NULL,
  rechazados    INT         NOT NULL,
  transformados INT         NOT NULL DEFAULT 0,
  anonimizados  INT         NOT NULL DEFAULT 0,
  observaciones TEXT        NULL,
  CONSTRAINT chk_bit_tipo    CHECK (tipo_archivo IN ('usuarios', 'interacciones')),
  CONSTRAINT chk_bit_conteos CHECK (recibidos >= 0 AND aceptados >= 0 AND rechazados >= 0),
  CONSTRAINT chk_bit_suma    CHECK (aceptados + rechazados = recibidos),
  CONSTRAINT chk_bit_transf  CHECK (transformados BETWEEN 0 AND aceptados),
  CONSTRAINT chk_bit_anon    CHECK (anonimizados BETWEEN 0 AND aceptados),
  CONSTRAINT fk_bit_admin FOREIGN KEY (id_admin) REFERENCES usuario_admin (id_admin) ON DELETE SET NULL
);
