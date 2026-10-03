import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPoll } from '../api.js';

// Value for a datetime-local input, N days from now, in local time.
function defaultExpiry(days = 7) {
  const d = new Date(Date.now() + days * 86400000);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function validateForm({ question, options, expiresAt }) {
  const errors = [];
  if (!question.trim()) errors.push('Question is required.');
  const labels = options.map((o) => o.trim());
  if (labels.some((o) => !o)) errors.push('Fill in or remove empty options.');
  if (labels.length < 2 || labels.length > 6) errors.push('A poll needs between 2 and 6 options.');
  const lower = labels.map((o) => o.toLowerCase());
  if (new Set(lower).size !== lower.length) errors.push('Options must be unique.');
  if (!expiresAt || new Date(expiresAt).getTime() <= Date.now()) errors.push('Expiry must be in the future.');
  return errors;
}

export default function CreatePoll() {
  const navigate = useNavigate();
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [expiresAt, setExpiresAt] = useState(defaultExpiry());
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const setOption = (i, value) => setOptions(options.map((o, idx) => (idx === i ? value : o)));

  async function onSubmit(e) {
    e.preventDefault();
    const problems = validateForm({ question, options, expiresAt });
    setErrors(problems);
    if (problems.length) return;
    setBusy(true);
    try {
      const poll = await createPoll({
        question: question.trim(),
        options: options.map((o) => o.trim()),
        expiresAt: new Date(expiresAt).toISOString(),
      });
      navigate(`/polls/${poll.id}`);
    } catch (err) {
      setErrors([err.message]);
      setBusy(false);
    }
  }

  return (
    <form className="card" onSubmit={onSubmit} noValidate>
      <h1>Create a poll</h1>

      <label htmlFor="question">Question</label>
      <input
        id="question"
        type="text"
        value={question}
        maxLength={300}
        placeholder="What should we have for lunch?"
        onChange={(e) => setQuestion(e.target.value)}
      />

      <label>Options (2–6)</label>
      {options.map((opt, i) => (
        <div className="option-row" key={i}>
          <input
            type="text"
            aria-label={`Option ${i + 1}`}
            value={opt}
            maxLength={100}
            placeholder={`Option ${i + 1}`}
            onChange={(e) => setOption(i, e.target.value)}
          />
          {options.length > 2 && (
            <button type="button" className="btn btn-ghost" onClick={() => setOptions(options.filter((_, idx) => idx !== i))}>
              Remove
            </button>
          )}
        </div>
      ))}
      {options.length < 6 && (
        <button type="button" className="btn btn-ghost" onClick={() => setOptions([...options, ''])}>
          + Add option
        </button>
      )}

      <label htmlFor="expires">Closes on</label>
      <input id="expires" type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />

      {errors.length > 0 && (
        <div className="alert" role="alert">
          <ul>
            {errors.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
      )}

      <button type="submit" className="btn" disabled={busy}>
        {busy ? 'Creating…' : 'Create poll'}
      </button>
    </form>
  );
}
