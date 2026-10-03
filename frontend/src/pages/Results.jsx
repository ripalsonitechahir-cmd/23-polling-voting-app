import { Link, useParams } from 'react-router-dom';
import { getPoll } from '../api.js';
import { formatDate, ResultBars, StatusBadge, usePoll } from '../components.jsx';

export default function Results() {
  const { id } = useParams();
  // Re-fetches every 5 seconds while the poll is open; stops once it is closed.
  const { poll, error, updatedAt } = usePoll(id, getPoll, 5000);

  if (error && !poll) {
    return (
      <div className="card">
        <div className="alert">{error.status === 404 ? 'Poll not found.' : `Could not load results: ${error.message}`}</div>
        <Link to="/">Back to home</Link>
      </div>
    );
  }
  if (!poll) return <p className="muted">Loading results…</p>;

  return (
    <div className="card">
      <h1>{poll.question}</h1>
      <p className="muted">
        <StatusBadge closed={poll.isClosed} />{' '}
        {poll.isClosed ? `Final results · closed ${formatDate(poll.expiresAt)}` : `Live results · refreshes every 5 seconds`}
      </p>
      {error && <div className="alert">Could not refresh: {error.message}</div>}
      <ResultBars poll={poll} />
      {!poll.isClosed && updatedAt && <p className="muted small">Last updated {updatedAt.toLocaleTimeString()}</p>}
      <div className="actions">
        <Link to={`/polls/${poll.id}`} className="btn btn-ghost">
          Back to poll
        </Link>
        <Link to="/" className="btn btn-ghost">
          Home
        </Link>
      </div>
    </div>
  );
}
