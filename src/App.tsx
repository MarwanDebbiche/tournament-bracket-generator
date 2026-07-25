import { Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import SetupPage from './pages/SetupPage';
import TournamentPage from './pages/TournamentPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/setup/:id" element={<SetupPage />} />
      <Route path="/tournament/:id" element={<TournamentPage />} />
    </Routes>
  );
}
