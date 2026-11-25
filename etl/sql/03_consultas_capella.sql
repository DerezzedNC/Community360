-- =====================================================================
-- Consultas para las capturas de evidencia (Couchbase Capella · Query)
-- Contexto de consulta: bucket community360, scope app
-- =====================================================================

-- 1. Conteo de documentos por colección
SELECT COUNT(*) AS interacciones FROM community360.app.interacciones;
SELECT COUNT(*) AS cuarentena FROM community360.app.cuarentena;

-- 2. Motivos de cuarentena
SELECT m AS motivo, COUNT(*) AS total
FROM community360.app.cuarentena c UNNEST c.motivos m
GROUP BY m;

-- 3. Privacidad: ningún documento guarda país, estado o ciudad (debe dar 0)
SELECT COUNT(*) AS docs_con_geo
FROM community360.app.interacciones
WHERE pais IS NOT MISSING OR estado IS NOT MISSING OR ciudad IS NOT MISSING;

-- 4. Las reacciones no llevan texto (debe dar 0)
SELECT COUNT(*) AS reacciones_con_texto
FROM community360.app.interacciones
WHERE tipo = "reaccion" AND texto IS NOT MISSING;

-- 5. Ejemplo de agregación para el dashboard
SELECT canal, tema, COUNT(*) AS total, ROUND(AVG(sentimiento), 3) AS sentimiento
FROM community360.app.interacciones
GROUP BY canal, tema
ORDER BY total DESC
LIMIT 10;
