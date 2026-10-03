const MAX_QUESTION = 300;
const MAX_LABEL = 100;

class ValidationError extends Error {
  constructor(errors) {
    super('Validation failed');
    this.errors = errors;
  }
}

function validatePollInput(body, defaultExpiryDays) {
  const errors = [];
  const b = body && typeof body === 'object' ? body : {};

  const question = typeof b.question === 'string' ? b.question.trim() : '';
  if (!question) errors.push('Question is required');
  else if (question.length > MAX_QUESTION) errors.push(`Question must be at most ${MAX_QUESTION} characters`);

  let options = [];
  if (!Array.isArray(b.options)) {
    errors.push('Options must be a list');
  } else {
    if (b.options.some((o) => typeof o !== 'string')) errors.push('Each option must be text');
    options = b.options.filter((o) => typeof o === 'string').map((o) => o.trim());
    if (options.some((o) => !o)) errors.push('Options must not be empty');
    if (options.length < 2 || options.length > 6) errors.push('A poll needs between 2 and 6 options');
    if (options.some((o) => o.length > MAX_LABEL)) errors.push(`Options must be at most ${MAX_LABEL} characters`);
    const lower = options.map((o) => o.toLowerCase());
    if (new Set(lower).size !== lower.length) errors.push('Options must be unique');
  }

  let expiresAt;
  if (b.expiresAt === undefined || b.expiresAt === null || b.expiresAt === '') {
    expiresAt = new Date(Date.now() + defaultExpiryDays * 86400000);
  } else {
    expiresAt = new Date(b.expiresAt);
    if (Number.isNaN(expiresAt.getTime())) errors.push('Expiry date is invalid');
    else if (expiresAt.getTime() <= Date.now()) errors.push('Expiry date must be in the future');
  }

  if (errors.length) throw new ValidationError(errors);
  return { question, options, expiresAt };
}

function parseId(value) {
  return /^\d+$/.test(String(value)) ? parseInt(value, 10) : null;
}

module.exports = { ValidationError, validatePollInput, parseId };
