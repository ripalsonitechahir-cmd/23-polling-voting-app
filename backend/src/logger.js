// Structured JSON logs to stdout.
function log(level, msg, extra = {}) {
  process.stdout.write(JSON.stringify({ time: new Date().toISOString(), level, msg, ...extra }) + '\n');
}

module.exports = {
  info: (msg, extra) => log('info', msg, extra),
  warn: (msg, extra) => log('warn', msg, extra),
  error: (msg, extra) => log('error', msg, extra),
};
