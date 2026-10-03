async function request(url, options) {
  const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...options });
  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response; fall through to the generic error below
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const listPolls = () => request('/api/polls');
export const getPoll = (id) => request(`/api/polls/${id}`);
export const createPoll = (body) => request('/api/polls', { method: 'POST', body: JSON.stringify(body) });
export const castVote = (id, optionId) =>
  request(`/api/polls/${id}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) });
