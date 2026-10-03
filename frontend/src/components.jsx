import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export const formatDate = (iso) =>
  new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

export function StatusBadge({ closed }) {
  return <span className={`badge ${closed ? 'badge-closed' : 'badge-open'}`}>{closed ? 'Closed' : 'Open'}</span>;
}

export function ResultBars({ poll }) {
  return (
    <div className="bars" role="list">
      {poll.options.map((o) => (
        <div className="bar-row" role="listitem" key={o.id}>
          <div className="bar-label">
            <span>{o.label}</span>
            <span>
              {o.percentage}% ({o.voteCount} {o.voteCount === 1 ? 'vote' : 'votes'})
            </span>
          </div>
          <div className="bar-track" aria-hidden="true">
            <div className="bar-fill" style={{ width: `${o.percentage}%` }} />
          </div>
        </div>
      ))}
      <p className="muted">Total votes: {poll.totalVotes}</p>
    </div>
  );
}

export function PollList({ polls, empty }) {
  if (!polls.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="poll-list">
      {polls.map((p) => (
        <li key={p.id}>
          <Link to={`/polls/${p.id}`} className="poll-link">
            <span className="poll-question">{p.question}</span>
            <span className="poll-meta">
              <StatusBadge closed={p.isClosed} /> {p.totalVotes} {p.totalVotes === 1 ? 'vote' : 'votes'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// Loads a poll and re-fetches it every `intervalMs` (stops once the poll is closed).
export function usePoll(id, fetcher, intervalMs = 5000) {
  const [poll, setPoll] = useState(null);
  const [error, setError] = useState(null);
  const [updatedAt, setUpdatedAt] = useState(null);
  const closedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    let timer;
    closedRef.current = false;
    setPoll(null);
    setError(null);

    async function load() {
      try {
        const data = await fetcher(id);
        if (cancelled) return;
        setPoll(data);
        setError(null);
        setUpdatedAt(new Date());
        closedRef.current = data.isClosed;
      } catch (err) {
        if (!cancelled) setError(err);
      }
      if (!cancelled && !closedRef.current) timer = setTimeout(load, intervalMs);
    }
    load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [id, fetcher, intervalMs]);

  return { poll, setPoll, error, updatedAt };
}
