// src/App.tsx

import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { ativarAparencia } from './utils/aparencia';
import Home         from './pages/Home';
import Login        from './pages/Login';
import Cadastro     from './pages/Cadastro';
import ComoFunciona from './pages/ComoFunciona';
import LandingPage  from './pages/LandingPage';
import Termos       from './pages/Termos';
import Privacidade  from './pages/Privacidade';
import NotFound      from './pages/NotFound';
import ResetarSenha  from './pages/ResetarSenha';
import { AuthProvider } from './contexts/AuthContext';
import { PrivateRoute } from './components/private-route';
import AdminRoute     from './components/AdminRoute';
import AdminDashboard from "./pages/Admin/AdminDashboard";
import Planos         from './pages/Planos';
import Radar          from './pages/Radar';
import Conta          from './pages/Conta';
import Prazos         from './pages/Prazos';
import PastaPublica   from './pages/PastaPublica';

// O painel admin tem visual próprio: não recebe tema/cor escolhidos
function AparenciaPorRota() {
  const { pathname } = useLocation();
  useEffect(() => { ativarAparencia(!pathname.startsWith('/admin')); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AparenciaPorRota />
        <div className="min-h-screen bg-(--fundo) selection:bg-purple-500 selection:text-white font-sans">
          <Routes>
            <Route path="/"              element={<LandingPage />} />
            <Route path="/como-funciona" element={<ComoFunciona />} />
            <Route path="/login"         element={<Login />} />
            <Route path="/cadastro"      element={<Cadastro />} />
            <Route path="/termos"        element={<Termos />} />
            <Route path="/privacidade"      element={<Privacidade />} />
            <Route path="/redefinir-senha"  element={<ResetarSenha />} />
            <Route path="/dashboard" element={
              <PrivateRoute>
                <Home />
              </PrivateRoute>
            } />

            <Route path="/radar" element={
              <PrivateRoute>
                <Radar />
              </PrivateRoute>
            } />
            <Route path="/p/:token" element={<PastaPublica />} />
            <Route path="/prazos" element={
              <PrivateRoute>
                <Prazos />
              </PrivateRoute>
            } />
            <Route path="/conta" element={
              <PrivateRoute>
                <Conta />
              </PrivateRoute>
            } />
            <Route path="/planos" element={
              <PrivateRoute>
                <Planos />
              </PrivateRoute>
            } />

            {/* ✅ Rota admin — só acessível para role === 'admin' */}
            <Route path="/admin" element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            } />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}