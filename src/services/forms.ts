/**
 * Client for the forms service (forms.tidycode.ai), which emails contact and
 * feedback messages. Submissions need a solved proof-of-work challenge.
 */

const FORMS_URL = import.meta.env.VITE_FORMS_URL || 'https://forms.tidycode.ai';
// Challenges expire after an hour; refetch before that
const CHALLENGE_MAX_AGE_MS = 50 * 60 * 1000;

const ERROR_MESSAGES: Record<string, string> = {
  rate_limited: 'You have sent several messages recently. Please try again later.',
  message_required: 'Please write a message.',
  message_too_long: 'Your message is too long (5,000 characters at most).',
  too_many_links: 'Please include no more than 2 links.',
  invalid_email: 'Please check your email address.'
};

const UNREACHABLE = "Couldn't reach our message service. Check your connection and try again.";

type Solution = { algorithm: string; challenge: string; number: number; salt: string; signature: string };

export type MessageFields = {
  name: string;
  email: string;
  message: string;
  /** Honeypot: hidden from people, so only bots fill it in */
  website: string;
};

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// Find n where sha256(salt + n) equals the challenge, hashing in batches
async function solve(challenge: string, salt: string, maxNumber: number) {
  const encoder = new TextEncoder();
  const batch = 1000;
  for (let start = 0; start <= maxNumber; start += batch) {
    const numbers: number[] = [];
    for (let n = start; n < start + batch && n <= maxNumber; n++) numbers.push(n);
    const hashes = await Promise.all(
      numbers.map((n) => crypto.subtle.digest('SHA-256', encoder.encode(salt + n)))
    );
    const index = hashes.findIndex((hash) => toHex(hash) === challenge);
    if (index !== -1) return numbers[index];
  }
  throw new Error('Challenge could not be solved');
}

async function fetchSolution(siteId: string): Promise<Solution> {
  const response = await fetch(`${FORMS_URL}/v1/challenge?site=${encodeURIComponent(siteId)}`);
  if (!response.ok) throw new Error('challenge_unavailable');
  const { algorithm, challenge, maxnumber, salt, signature } = await response.json();
  const number = await solve(challenge, salt, maxnumber);
  return { algorithm, challenge, number, salt, signature };
}

/**
 * One form's session. Call prepare() when someone starts filling in the form
 * so the proof of work is done by the time they press Send.
 */
export function createFormSession(siteId: string) {
  let pending: { promise: Promise<Solution>; fetchedAt: number } | null = null;

  function prepare(force = false) {
    if (force || !pending || Date.now() - pending.fetchedAt > CHALLENGE_MAX_AGE_MS) {
      const promise = fetchSolution(siteId);
      promise.catch(() => {
        if (pending?.promise === promise) pending = null;
      });
      pending = { promise, fetchedAt: Date.now() };
    }
    return pending.promise;
  }

  /** @throws Error with a message suitable for showing to the user */
  async function submit(fields: MessageFields, retried = false): Promise<void> {
    let response: Response;
    try {
      const altcha = await prepare();
      response = await fetch(`${FORMS_URL}/v1/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ site: siteId, ...fields, page: window.location.href, altcha })
      });
    } catch {
      throw new Error(UNREACHABLE);
    }

    const body = await response.json().catch(() => ({}));
    if (response.ok && body.ok) return;

    if (!retried && body.error === 'too_fast') {
      // Sent before the minimum time on the form: the same solution works once it has passed
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return submit(fields, true);
    }
    // A fresh challenge fixes expired or reused ones
    if (!retried && ['challenge_expired', 'challenge_used', 'challenge_failed'].includes(body.error)) {
      prepare(true);
      return submit(fields, true);
    }

    const code = body.fields?.[0] || body.error;
    throw new Error(ERROR_MESSAGES[code] || 'Sorry, your message could not be sent. Please try again.');
  }

  return { prepare, submit };
}
