import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import StoryPage from './pages/StoryPage';
import EditorPage from './pages/EditorPage';
import LoginPage from './pages/LoginPage';
import './index.css';
import './App.css';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/story/:id" element={<StoryPage />} />
        <Route path="/editor" element={<EditorPage />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
      <Footer />
    </Router>
  );
}

export default App;
