import type {Scene} from '@/api/scene';

export type {Scene};

/** Stream an answer. `onScene` fires as soon as the viewer has something to aim
 * at, which is before the prose is finished; `onAnswer` fires once with the
 * complete reply. */
export async function ask(
  question: string,
  handlers: {onScene: (scene: Scene) => void; onAnswer: (scene: Scene) => void},
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch('/api/ask', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({question}),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.json().catch(() => ({})) as {error?: string};
    throw new Error(detail.error ?? 'The anatomy assistant is unavailable.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';
    for (const frame of frames) {
      const event = frame.match(/^event: (\w+)$/m)?.[1];
      const data = frame.match(/^data: (.*)$/m)?.[1];
      if (!event || !data) continue;
      const payload = JSON.parse(data);
      if (event === 'error') throw new Error(payload.error ?? 'The anatomy assistant failed.');
      if (event === 'scene') handlers.onScene(payload as Scene);
      if (event === 'answer') handlers.onAnswer(payload as Scene);
    }
  }
}
