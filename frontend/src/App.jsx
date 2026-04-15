// src/App.tsx

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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

// ✅ Novos imports
import AdminRoute     from './components/AdminRoute';
import AdminDashboard from './pages/AdminDashboard';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen bg-[#0a0a0a] selection:bg-purple-500 selection:text-white font-sans">
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