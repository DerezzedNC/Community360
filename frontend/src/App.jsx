import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LayoutDashboard from './componentes/LayoutDashboard';
import RutaProtegida from './componentes/RutaProtegida';
import PaginaLogin from './paginas/PaginaLogin';

const PaginaDashboard = lazy(() => import('./paginas/PaginaDashboard'));
const VistaUsuarios = lazy(() => import('./paginas/VistaUsuarios'));
const VistaCuarentena = lazy(() => import('./paginas/VistaCuarentena'));

function CargandoVista() {
  return (
    <div className="estado-grafica" role="status" aria-live="polite">
      <span className="indicador-carga" aria-hidden="true" />
      <p className="estado-grafica__texto">Cargando vista…</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PaginaLogin />} />
        <Route element={<RutaProtegida />}>
          <Route path="/dashboard" element={<LayoutDashboard />}>
            <Route
              index
              element={
                <Suspense fallback={<CargandoVista />}>
                  <PaginaDashboard />
                </Suspense>
              }
            />
            <Route
              path="usuarios"
              element={
                <Suspense fallback={<CargandoVista />}>
                  <VistaUsuarios />
                </Suspense>
              }
            />
            <Route
              path="cuarentena"
              element={
                <Suspense fallback={<CargandoVista />}>
                  <VistaCuarentena />
                </Suspense>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
