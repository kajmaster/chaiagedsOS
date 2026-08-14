/**
 * One free-text note per channel replaced five fixed credential fields.
 * The placeholder suggests a shape without enforcing one — people keep
 * different things, and the box should not argue with them.
 */
export const NOTE_PLACEHOLDER = [
  'Username: ',
  'Email: ',
  'Password: ',
  '2FA / secret: ',
  'Recovery email: ',
  '',
  'Anything else you would forget in three months…',
].join('\n');
