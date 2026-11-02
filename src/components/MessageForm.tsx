import { useMemo, useState, type FormEvent } from 'react';
import { createFormSession } from '../services/forms';

type Props = {
  id?: string;
  siteId: string;
  messagePlaceholder: string;
  submitLabel: string;
  successText: string;
  emailRequired?: boolean;
};

export function MessageForm({ id, siteId, messagePlaceholder, submitLabel, successText, emailRequired = false }: Props) {
  const session = useMemo(() => createFormSession(siteId), [siteId]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSending(true);
    setError(null);
    try {
      await session.submit({ name, email, message, website });
      setSent(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="tagline" role="status" style={{ marginTop: 12, lineHeight: 1.7 }}>
        {successText}
      </div>
    );
  }

  return (
    <form id={id} onSubmit={handleSubmit} onFocus={() => void session.prepare().catch(() => {})} style={{ marginTop: 12, display: 'grid', gap: 10 }}>
      <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <input
          className="input"
          type="text"
          name="name"
          aria-label="Your name (optional)"
          placeholder="Your name (optional)"
          autoComplete="name"
          maxLength={100}
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ font: 'inherit' }}
        />
        <input
          className="input"
          type="email"
          name="email"
          aria-label={emailRequired ? 'Your email' : 'Your email (optional, if you would like a reply)'}
          placeholder={emailRequired ? 'Your email' : 'Your email (optional, if you would like a reply)'}
          autoComplete="email"
          maxLength={254}
          required={emailRequired}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ font: 'inherit' }}
        />
      </div>
      <textarea
        className="input"
        name="message"
        aria-label="Message"
        placeholder={messagePlaceholder}
        required
        minLength={2}
        maxLength={5000}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        style={{ minHeight: 130, resize: 'vertical', font: 'inherit' }}
      />
      {/* Honeypot: off screen, so only bots fill it in */}
      <div aria-hidden="true" style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}>
        <label>
          Leave this field empty
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
      </div>
      {error ? <div className="tagline" role="alert" style={{ color: '#fca5a5' }}>{error}</div> : null}
      <div>
        <button className="ghost-button" type="submit" disabled={sending}>
          {sending ? 'Sending…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
