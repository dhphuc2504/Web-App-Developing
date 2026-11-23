import {createHash, randomBytes} from 'node:crypto';
import nodemailer from 'nodemailer';

export const tokenDigest = token => createHash('sha256').update(token).digest('hex');
export const validEmail = email => typeof email === 'string' && email.length <= 254 &&
  /^[^\s@,;:<>"\\\[\]\x00-\x1f\x7f]+@(?:[a-z0-9-]+\.)+[a-z0-9-]+$/i.test(email);

export function verificationMailer(config = process.env, createTransport = nodemailer.createTransport) {
  return async (email, token) => {
    if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASSWORD || !config.SMTP_FROM || !validEmail(email))
      throw new Error('Email delivery is unavailable.');
    const origin = new URL(config.APP_ORIGIN || 'http://localhost:3000');
    if (!['https:', 'http:'].includes(origin.protocol)) throw new Error('Invalid app origin.');
    const link = new URL('/#/verify-email/' + token, origin.origin);
    const secure = config.SMTP_SECURE === 'true';
    const transport = createTransport({
      host: config.SMTP_HOST, port: Number(config.SMTP_PORT || 587), secure, requireTLS: !secure,
      auth: {user: config.SMTP_USER, pass: config.SMTP_PASSWORD},
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000
    });
    try {
      await transport.sendMail({
        from: config.SMTP_FROM, to: {address: email, name: ''}, subject: 'Verify your Stillroom email',
        text: `Open this link and enter your Stillroom password to verify your email:\n\n${link}\n\nThe link expires in 24 hours and works once. If you did not request it, you can ignore this email.`
      });
    } finally {
      transport.close();
    }
  };
}

export async function requestVerification(db, user, send) {
  const token = randomBytes(32).toString('hex');
  const digest = tokenDigest(token);
  const claimed = await db.query(`UPDATE stillroom.accounts
    SET verification_digest=$2, verification_sent_at=now()
    WHERE id=$1 AND email_verified_at IS NULL AND
      (verification_sent_at IS NULL OR verification_sent_at <= now() - interval '1 minute')
    RETURNING id`, [user.id, digest]);
  if (!claimed.rows.length) return;
  try {
    await send(user.email, token);
  } catch {
    await db.query(`UPDATE stillroom.accounts SET verification_digest=NULL, verification_sent_at=NULL
      WHERE id=$1 AND verification_digest=$2`, [user.id, digest]);
    throw Object.assign(new Error('We couldn’t send the verification email. Sign in again to retry.'), {status:503, mailUnavailable:true});
  }
}
