import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listPolls } from '../api.js';
import { PollList } from '../components.jsx';

export default function Home() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    listPolls()
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className="alert">Could not load polls: {error.message}</div>;
  if (!data) return <p className="muted">Loading polls…</p>;

  return (
    <>
      <div className="hero">
        <h1>Create a poll, share the link, get answers.</h1>
        <Link to="/create" className="btn">
          Create a poll
        </Link>
      </div>
      <section className="card">
        <h2>Trending polls</h2>
        <PollList polls={data.trending} empty="No open polls yet. Be the first to create one!" />
      </section>
      <section className="card">
        <h2>Recent polls</h2>
        <PollList polls={data.recent.slice(0, 20)} empty="Nothing here yet." />
      </section>
    </>
  );
}
