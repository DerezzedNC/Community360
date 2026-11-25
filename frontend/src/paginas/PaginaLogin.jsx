import { Link } from 'react-router-dom';

export default function PaginaLogin() {
  return (
    <main className="contenedor-centrado">
      <section className="tarjeta-acceso">
        <p className="tarjeta-acceso__marca">COMMUNITY 360</p>
        <h1 className="tarjeta-acceso__titulo">Acceso al panel</h1>
        <p className="tarjeta-acceso__texto">
          Ruta de inicio de sesión preparada para conectarse a{' '}
          <code>POST /api/auth/login</code> en la tarea F3-07.
        </p>
        <Link to="/dashboard" className="enlace-secundario">
          Ir al layout del dashboard
        </Link>
      </section>
    </main>
  );
}
