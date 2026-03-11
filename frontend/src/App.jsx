import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import ComoFunciona from './pages/ComoFunciona';
import LandingPage from './pages/LandingPage';
import Cadastro from './pages/Cadastro';

export default function App() {
  return (
    <Router>
      {/* O container principal mantém o fundo escuro consistente em todo o site [cite: 8] */}
      <div className="min-h-screen bg-[#0a0a0a] selection:bg-emerald-400 selection:text-black font-sans">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/como-funciona" element={<ComoFunciona />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />

          <Route path="*" element={
            <div className="flex items-center justify-center h-screen text-white font-mono text-sm uppercase tracking-widest">
              404 | Página não encontrada
            </div>
          } />
        </Routes>
      </div>
    </Router>
  );
}