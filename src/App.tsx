import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { HomePage } from "./components/HomePage";
import { GamePlayer } from "./components/GamePlayer";
import { GameEditor } from "./components/GameEditor";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/game/:code" element={<GamePlayer />} />
        <Route path="/game/:code/admin/:token" element={<GameEditor />} />
      </Routes>
    </Router>
  );
}

export default App;
