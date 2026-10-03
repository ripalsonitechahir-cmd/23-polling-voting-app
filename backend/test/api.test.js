const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const dbFile = path.join(os.tmpdir(), `polls-test-${process.pid}.db`);
process.env.DATABASE_URL = `file:${dbFile.replace(/\\/g, '/')}`;
process.env.STATIC_DIR = path.join(os.tmpdir(), 'no-such-dir');

let server;
let base;
let prisma;

const post = (url, body, headers = {}) =>
  fetch(base + url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
const ip = (n) => ({ 'x-forwarded-for': `10.0.0.${n}` });
const future = () => new Date(Date.now() + 86400000).toISOString();

before(async () => {
  execSync('npx prisma migrate deploy', { cwd: path.join(__dirname, '..'), stdio: 'ignore' });
  const app = require('../src/app');
  prisma = require('../src/db').prisma;
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  server.close();
  await prisma.$disconnect();
  for (const suffix of ['', '-wal', '-shm', '-journal']) fs.rmSync(dbFile + suffix, { force: true });
});

test('GET /health returns 200 when the database is reachable', async () => {
  const res = await fetch(base + '/health');
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { status: 'ok' });
});

test('POST /api/polls creates a poll with 2-6 options', async () => {
  const res = await post('/api/polls', { question: ' Best color? ', options: ['Red', 'Blue'], expiresAt: future() });
  assert.equal(res.status, 201);
  const poll = await res.json();
  assert.equal(poll.question, 'Best color?');
  assert.equal(poll.options.length, 2);
  assert.equal(poll.totalVotes, 0);
  assert.equal(poll.isClosed, false);
});

test('POST /api/polls applies a default expiry when none is given', async () => {
  const res = await post('/api/polls', { question: 'Q?', options: ['a', 'b'] });
  assert.equal(res.status, 201);
  assert.ok(new Date((await res.json()).expiresAt) > new Date());
});

test('POST /api/polls rejects invalid input with 400, never 500', async () => {
  const cases = [
    {},
    { question: '', options: ['a', 'b'] },
    { question: 'Q', options: ['a'] },
    { question: 'Q', options: ['a', 'b', 'c', 'd', 'e', 'f', 'g'] },
    { question: 'Q', options: ['a', ''] },
    { question: 'Q', options: ['a', 'A'] },
    { question: 'Q', options: ['a', 5] },
    { question: 'Q', options: 'nope' },
    { question: 5, options: ['a', 'b'] },
    { question: 'Q', options: ['a', 'b'], expiresAt: 'garbage' },
    { question: 'Q', options: ['a', 'b'], expiresAt: new Date(Date.now() - 1000).toISOString() },
  ];
  for (const body of cases) {
    const res = await post('/api/polls', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.ok((await res.json()).error);
  }
  assert.equal((await post('/api/polls', '{bad json')).status, 400);
});

test('GET /api/polls lists recent and trending polls', async () => {
  const quiet = await (await post('/api/polls', { question: 'Quiet', options: ['a', 'b'] })).json();
  const busy = await (await post('/api/polls', { question: 'Busy', options: ['a', 'b'] })).json();
  await post(`/api/polls/${busy.id}/vote`, { optionId: busy.options[0].id }, ip(21));

  const res = await fetch(base + '/api/polls');
  assert.equal(res.status, 200);
  const { recent, trending } = await res.json();
  assert.ok(recent.length >= 2);
  assert.equal(recent[0].id, busy.id); // newest first
  assert.equal(trending[0].id, busy.id); // most votes first
  assert.ok(trending.some((p) => p.id === quiet.id));
});

test('GET /api/polls/:id returns details, 404 for unknown, 400 for bad id', async () => {
  const poll = await (await post('/api/polls', { question: 'Q', options: ['a', 'b'] })).json();
  const ok = await fetch(`${base}/api/polls/${poll.id}`);
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).hasVoted, false);
  assert.equal((await fetch(`${base}/api/polls/999999`)).status, 404);
  assert.equal((await fetch(`${base}/api/polls/abc`)).status, 400);
});

test('voting updates counts and percentages', async () => {
  const poll = await (await post('/api/polls', { question: 'Q', options: ['a', 'b'] })).json();
  const [a, b] = poll.options;
  assert.equal((await post(`/api/polls/${poll.id}/vote`, { optionId: a.id }, ip(31))).status, 201);
  assert.equal((await post(`/api/polls/${poll.id}/vote`, { optionId: a.id }, ip(32))).status, 201);
  const last = await post(`/api/polls/${poll.id}/vote`, { optionId: b.id }, ip(33));
  const result = await last.json();
  assert.equal(result.totalVotes, 3);
  assert.equal(result.options[0].voteCount, 2);
  assert.equal(result.options[0].percentage, 66.7);
  assert.equal(result.options[1].percentage, 33.3);
});

test('a second vote from the same IP is rejected with 409', async () => {
  const poll = await (await post('/api/polls', { question: 'Q', options: ['a', 'b'] })).json();
  const first = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id }, ip(41));
  assert.equal(first.status, 201);
  const second = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[1].id }, ip(41));
  assert.equal(second.status, 409);
  const detail = await (await fetch(`${base}/api/polls/${poll.id}`, { headers: ip(41) })).json();
  assert.equal(detail.hasVoted, true);
  assert.equal(detail.totalVotes, 1);
});

test('a second vote from the same browser (cookie) is rejected even from a new IP', async () => {
  const poll = await (await post('/api/polls', { question: 'Q', options: ['a', 'b'] })).json();
  const first = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id }, ip(51));
  const cookie = first.headers.get('set-cookie').split(';')[0];
  const second = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[1].id }, { ...ip(52), cookie });
  assert.equal(second.status, 409);
});

test('vote validation: missing option, foreign option, unknown poll', async () => {
  const poll = await (await post('/api/polls', { question: 'Q', options: ['a', 'b'] })).json();
  const other = await (await post('/api/polls', { question: 'Q2', options: ['a', 'b'] })).json();
  assert.equal((await post(`/api/polls/${poll.id}/vote`, {}, ip(61))).status, 400);
  assert.equal((await post(`/api/polls/${poll.id}/vote`, { optionId: 'x' }, ip(61))).status, 400);
  assert.equal((await post(`/api/polls/${poll.id}/vote`, { optionId: other.options[0].id }, ip(61))).status, 400);
  assert.equal((await post('/api/polls/999999/vote', { optionId: 1 }, ip(61))).status, 404);
});

test('expired polls are closed: voting is refused and final results remain', async () => {
  const poll = await (await post('/api/polls', { question: 'Q', options: ['a', 'b'] })).json();
  await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[0].id }, ip(71));
  await prisma.poll.update({ where: { id: poll.id }, data: { expiresAt: new Date(Date.now() - 1000) } });

  const detail = await (await fetch(`${base}/api/polls/${poll.id}`)).json();
  assert.equal(detail.isClosed, true);
  assert.equal(detail.totalVotes, 1);
  const res = await post(`/api/polls/${poll.id}/vote`, { optionId: poll.options[1].id }, ip(72));
  assert.equal(res.status, 409);
  assert.equal(await prisma.poll.count({ where: { id: poll.id, isClosed: true } }), 1);
});

test('unknown API routes return JSON 404', async () => {
  const res = await fetch(base + '/api/nope');
  assert.equal(res.status, 404);
  assert.ok((await res.json()).error);
});
