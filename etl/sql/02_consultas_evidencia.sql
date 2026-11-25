-- =====================================================================
-- Consultas para las capturas de evidencia (TiDB Cloud · SQL Editor)
-- =====================================================================
USE community360;

-- 1. Tablas creadas
SHOW TABLES;

-- 2. Conteo final de registros cargados
SELECT 'usuario' AS tabla, COUNT(*) AS registros FROM usuario
UNION ALL SELECT 'ubicacion_usuario', COUNT(*) FROM ubicacion_usuario
UNION ALL SELECT 'pais', COUNT(*) FROM pais
UNION ALL SELECT 'estado', COUNT(*) FROM estado
UNION ALL SELECT 'ciudad', COUNT(*) FROM ciudad
UNION ALL SELECT 'bitacora_carga', COUNT(*) FROM bitacora_carga;

-- 3. Privacidad: usuarios sin consentimiento que conservan datos geográficos (debe dar 0)
SELECT COUNT(*) AS sin_consentimiento_con_geo
FROM usuario u
JOIN ubicacion_usuario x ON x.id_usuario = u.id_usuario
WHERE u.consentimiento_datos = FALSE;

-- 4. Resumen por consentimiento
SELECT u.consentimiento_datos,
       COUNT(*)            AS usuarios,
       COUNT(x.id_usuario) AS con_ubicacion
FROM usuario u
LEFT JOIN ubicacion_usuario x ON x.id_usuario = u.id_usuario
GROUP BY u.consentimiento_datos;

-- 5. Bitácora de la carga
SELECT tipo_archivo, recibidos, aceptados, rechazados, transformados, anonimizados, ejecutado_en
FROM bitacora_carga ORDER BY ejecutado_en DESC;

-- 6. Prueba de restricciones: debe FALLAR por el CHECK de estatus
-- INSERT INTO usuario (id_usuario, alias, fecha_ingreso, cod_rango_edad, cod_especie, cod_interes,
--   cod_plataforma, ultima_actividad, estatus)
-- VALUES ('U999999', 'prueba', '2026-11-01', '18_24', 'zorro', 'arte_digital', 'telegram', '2026-11-01', 'feliz');
