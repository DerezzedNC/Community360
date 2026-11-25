import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LayoutDashboard from './componentes/LayoutDashboard';
import RutaProtegida from './componentes/RutaProtegida';
import VistaDashboardVacia from './paginas/VistaDashboardVacia';
import PaginaLogin from './paginas/PaginaLogin';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<PaginaLogin />} />
        <Route element={<RutaProtegida />}>
          <Route path="/dashboard" element={<LayoutDashboard />}>
            <Route index element={<VistaDashboardVacia />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
