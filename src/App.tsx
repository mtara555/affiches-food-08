import { Navigate, Route, Routes } from 'react-router-dom';
import { Accueil } from './pages/Accueil';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Accueil />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
