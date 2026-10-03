import { Link, NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import CreatePoll from './pages/CreatePoll.jsx';
import PollDetail from './pages/PollDetail.jsx';
import Results from './pages/Results.jsx';

export default function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          Polling &amp; Voting
        </Link>
        <nav>
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/create">Create Poll</NavLink>
        </nav>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create" element={<CreatePoll />} />
          <Route path="/polls/:id" element={<PollDetail />} />
          <Route path="/polls/:id/results" element={<Results />} />
          <Route
            path="*"
            element={
              <div className="card">
                <h2>Page not found</h2>
                <Link to="/">Back to home</Link>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}
