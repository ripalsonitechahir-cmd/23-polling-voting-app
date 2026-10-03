const crypto = require('crypto');
const express = require('express');
const { prisma } = require('./db');
const config = require('./config');
const { validatePollInput, parseId } = require('./validation');

const router = express.Router();

// Express 4 does not catch rejected promises, so forward them to the error handler.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const voterHash = (pollId, ip) => crypto.createHash('sha256').update(`${config.voterSalt}|${pollId}|${ip}`).digest('hex');

function serialize(poll) {
  const totalVotes = poll.options.reduce((sum, o) => sum + o.voteCount, 0);
  const closed = poll.isClosed || poll.expiresAt.getTime() <= Date.now();
  return {
    id: poll.id,
    question: poll.question,
    createdAt: poll.createdAt,
    expiresAt: poll.expiresAt,
    isClosed: closed,
    totalVotes,
    options: poll.options
      .slice()
      .sort((a, b) => a.id - b.id)
      .map((o) => ({
        id: o.id,
        label: o.label,
        voteCount: o.voteCount,
        percentage: totalVotes ? Math.round((o.voteCount / totalVotes) * 1000) / 10 : 0,
      })),
  };
}

// Persist is_closed for polls whose expiry has passed.
const closeExpired = () =>
  prisma.poll.updateMany({ where: { isClosed: false, expiresAt: { lte: new Date() } }, data: { isClosed: true } });

router.post('/', wrap(async (req, res) => {
  const { question, options, expiresAt } = validatePollInput(req.body, config.defaultExpiryDays);
  const poll = await prisma.poll.create({
    data: { question, expiresAt, options: { create: options.map((label) => ({ label })) } },
    include: { options: true },
  });
  res.status(201).json(serialize(poll));
}));

router.get('/', wrap(async (_req, res) => {
  await closeExpired();
  const polls = await prisma.poll.findMany({ include: { options: true }, orderBy: { createdAt: 'desc' } });
  const recent = polls.map(serialize);
  // Trending: most votes first, ties broken by newest. Only open polls compete.
  const trending = recent
    .filter((p) => !p.isClosed)
    .sort((a, b) => b.totalVotes - a.totalVotes || new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  res.json({ recent, trending });
}));

router.get('/:id', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid poll id' });
  await closeExpired();
  const poll = await prisma.poll.findUnique({ where: { id }, include: { options: true } });
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  const ipVote = await prisma.vote.findUnique({
    where: { pollId_voterHash: { pollId: id, voterHash: voterHash(id, req.ip) } },
  });
  res.json({ ...serialize(poll), hasVoted: Boolean(req.cookies[`voted_${id}`] || ipVote) });
}));

router.post('/:id/vote', wrap(async (req, res) => {
  const id = parseId(req.params.id);
  if (id === null) return res.status(400).json({ error: 'Invalid poll id' });
  const optionId = parseId(req.body && req.body.optionId);
  if (optionId === null) return res.status(400).json({ error: 'optionId is required' });

  const poll = await prisma.poll.findUnique({ where: { id }, include: { options: true } });
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  if (serialize(poll).isClosed) return res.status(409).json({ error: 'This poll is closed' });
  if (!poll.options.some((o) => o.id === optionId)) {
    return res.status(400).json({ error: 'Option does not belong to this poll' });
  }

  // One vote per browser (cookie) and per IP (hashed, unique per poll).
  if (req.cookies[`voted_${id}`]) return res.status(409).json({ error: 'You have already voted in this poll' });
  try {
    await prisma.$transaction([
      prisma.vote.create({ data: { pollId: id, optionId, voterHash: voterHash(id, req.ip) } }),
      prisma.option.update({ where: { id: optionId }, data: { voteCount: { increment: 1 } } }),
    ]);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'You have already voted in this poll' });
    throw err;
  }

  res.cookie(`voted_${id}`, '1', { maxAge: 365 * 86400000, httpOnly: true, sameSite: 'lax' });
  const updated = await prisma.poll.findUnique({ where: { id }, include: { options: true } });
  res.status(201).json({ ...serialize(updated), hasVoted: true });
}));

module.exports = { router };
