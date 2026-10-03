import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { castVote, getPoll } from '../api.js';
import { formatDate, ResultBars, StatusBadge, usePoll } from '../components.jsx';

export default function PollDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { poll, setPoll, error } = usePoll(id, getPoll, 60000);
  const [choice, setChoice] = useState(null);
  const [voteError, setVoteError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (error) {
    return (
      <div className="card">
        <div className="alert">{error.status === 404 ? 'Poll not found.' : `Could not load poll: ${error.message}`}</div>
        <Link to="/">Back to home</Link>
      </div>
    );
  }
  if (!poll) return <p className="muted">Loading poll…</p>;

  async function onVote(e) {
    e.preventDefault();
    if (choice === null) return setVoteError('Please choose an option.');
    setBusy(true);
    setVoteError(null);
    try {
      const updated = await castVote(poll.id, choice);
      setPoll(updated);
      navigate(`/polls/${poll.id}/results`);
    } catch (err) {
      setVoteError(err.message);
      if (err.status === 409) setPoll({ ...poll, hasVoted: true });
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', window.location.href);
    }
  }

  const canVote = !poll.isClosed && !poll.hasVoted;

  return (
    <div className="card">
      <h1>{poll.question}</h1>
      <p className="muted">
        <StatusBadge closed={poll.isClosed} /> {poll.isClosed ? 'Closed' : 'Closes'} {formatDate(poll.expiresAt)}
      </p>

      {canVote ? (
        <form onSubmit={onVote}>
          <fieldset>
            <legend className="sr-only">Choose an option</legend>
            {poll.options.map((o) => (
              <label className={`choice ${choice === o.id ? 'choice-selected' : ''}`} key={o.id}>
                <input type="radio" name="option" value={o.id} checked={choice === o.id} onChange={() => setChoice(o.id)} />
                {o.label}
              </label>
            ))}
          </fieldset>
          {voteError && (
            <div className="alert" role="alert">
              {voteError}
            </div>
          )}
          <button type="submit" className="btn" disabled={busy}>
            {busy ? 'Submitting…' : 'Vote'}
          </button>
        </form>
      ) : (
        <>
          <div className="notice">
            {poll.isClosed ? 'This poll is closed. Final results are shown below.' : 'You have already voted in this poll.'}
          </div>
          <ResultBars poll={poll} />
        </>
      )}

      <div className="actions">
        <Link to={`/polls/${poll.id}/results`} className="btn btn-ghost">
          View results
        </Link>
        <button type="button" className="btn btn-ghost" onClick={copyLink}>
          {copied ? 'Link copied!' : 'Copy share link'}
        </button>
      </div>
    </div>
  );
}
