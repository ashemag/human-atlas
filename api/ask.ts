import catalogData from './catalog.json';
import {validateScene, type Catalog, type ModelScene, type Scene} from './scene';
import {present, readRows, renderRows, shortlist, systemIndex} from './retrieve';

const catalog = catalogData as unknown as Catalog;
const rows = readRows(catalog);
const SYSTEM_INDEX = systemIndex(rows);
const MODEL = 'gemma-4-31b-it';


/** Gemma on this endpoint has no function calling, so the scene arrives as
 * schema-constrained JSON instead. A response schema is also what stops the
 * model narrating its reasoning into the reply - responseMimeType alone does
 * not. propertyOrdering puts the scene ahead of the prose so the camera can
 * start moving while the answer is still generating. */
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    focus: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          conceptId: {type: 'STRING'},
          name: {type: 'STRING'},
          side: {type: 'STRING', enum: ['left', 'right', 'both']},
          role: {type: 'STRING', enum: ['primary', 'secondary']},
          label: {type: 'STRING'},
        },
        required: ['conceptId', 'name', 'side', 'role', 'label'],
        propertyOrdering: ['conceptId', 'name', 'side', 'role', 'label'],
      },
    },
    systems: {type: 'ARRAY', items: {type: 'STRING', enum: catalog.systems}},
    view: {type: 'STRING', enum: ['three-quarter', 'front', 'back', 'side']},
    unmodeled: {type: 'ARRAY', items: {type: 'STRING'}},
    answer: {type: 'STRING'},
  },
  required: ['focus', 'systems', 'view', 'unmodeled', 'answer'],
  propertyOrdering: ['focus', 'systems', 'view', 'unmodeled', 'answer'],
};

/** Stage one. No catalog: the model is asked only what it knows anatomically.
 * Cheap, and its output is what the server searches the atlas with. */
const PROPOSE = `List the anatomical structures involved in the question below.

Use standard anatomical English (for example "fifth lumbar vertebra", not "L5"; "pectoralis major", not "chest muscle"). Include the structures the question is directly about first, then nearby structures that give useful context. At most 12. Name real anatomical structures only, whether or not any particular model contains them.`;

const PROPOSE_SCHEMA = {
  type: 'OBJECT',
  properties: {structures: {type: 'ARRAY', items: {type: 'STRING'}}},
  required: ['structures'],
};

/** Stage two. Only the shortlist the search returned, which is roughly a tenth
 * the size of the full catalog - and the free tier caps input at 16k tokens per
 * minute, so the full catalog does not fit in a single request. */
const compose = (candidates: string, absent: string[]) => `You help someone explore a 3D anatomical model of an adult male body. Answer their question and choose what the viewer should show.

The structures below are the ones this model contains that are relevant to the question, found by searching its full catalogue of ${rows.length} structures. Lines are: id, name, mesh count. They are grouped by anatomical system. "[L/R]" means the structure exists on both sides and you may set side to left, right or both; without it, use side "both".

The whole model covers: ${SYSTEM_INDEX}.
${absent.length ? `
Already checked and NOT present anywhere in this model: ${absent.join(', ')}. Put these in "unmodeled" if the question is about them, and show the nearest structures that are present instead.
` : ''}
RULES
1. Every conceptId must be copied exactly from the list below, and the name you return must be that entry's name, character for character. Never invent an id and never use an id that is not listed.
2. Prefer the most specific structure that answers the question. The mesh count is a size hint: a high count is a broad grouping, so pick it only when the question really is broad.
3. Mark what the question is about as "primary" and supporting context as "secondary". Aim for under ten entries.
4. Anything the question is about that is not in the list goes in "unmodeled", named in everyday words. Never substitute a different structure silently.
5. "systems" lists the systems to leave visible for context.
6. "view" is the camera angle that best exposes the primary structures: back for the spine and kidneys, front for the chest and abdominal wall, side for a profile.
7. "label" is what gets drawn on the model next to the structure: one to three words, the everyday name, no prefixes and no punctuation. "L5", "L4-L5 disk" and "Right kidney" are good labels; "label L2" and "Structure: fifth lumbar vertebra" are not.
8. "answer" is two to four sentences of plain language for someone without medical training: where the structure is and what it does. This is educational anatomy, not medical advice. Do not diagnose and do not recommend treatment; if the question sounds like a personal symptom, describe the anatomy involved and suggest seeing a clinician.

STRUCTURES IN THIS MODEL
${candidates}`;

interface AskBody {question?: string}

/** Pull a complete top-level JSON value out of a partial document, so the scene
 * can be dispatched before the model has finished writing the prose. */
function sliceValue(text: string, key: string): string | null {
  const at = text.indexOf(`"${key}"`);
  if (at < 0) return null;
  const colon = text.indexOf(':', at + key.length + 2);
  if (colon < 0) return null;
  let i = colon + 1;
  while (i < text.length && /\s/.test(text[i])) i++;
  if (i >= text.length) return null;
  const open = text[i];
  if (open !== '[' && open !== '{') return null;
  const close = open === '[' ? ']' : '}';
  let depth = 0, quoted = false, escaped = false;
  for (let j = i; j < text.length; j++) {
    const ch = text[j];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) return text.slice(i, j + 1);
  }
  return null;
}

/** The first balanced JSON object in the document.
 * Gemma reasons in prose by default and, on longer prompts, sometimes resumes
 * after the schema-constrained object has closed. Parsing the whole document
 * fails on that trailing text; parsing the first object does not. */
function firstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { quoted = !quoted; continue; }
    if (quoted) continue;
    if (ch === '{') depth++;
    else if (ch === '}' && --depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

const URL_FOR = (streaming: boolean) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:${streaming ? 'streamGenerateContent?alt=sse' : 'generateContent'}`;

function callModel(
  apiKey: string,
  {system, user, schema, streaming}: {system: string; user: string; schema: object; streaming: boolean},
) {
  return fetch(URL_FOR(streaming), {
    method: 'POST',
    headers: {'x-goog-api-key': apiKey, 'content-type': 'application/json'},
    body: JSON.stringify({
      systemInstruction: {parts: [{text: system}]},
      contents: [{role: 'user', parts: [{text: user}]}],
      generationConfig: {responseMimeType: 'application/json', responseSchema: schema, temperature: 0.2},
    }),
  });
}

export async function handleAsk(body: AskBody, apiKey: string): Promise<Response> {
  const question = (body.question ?? '').trim();
  const json = (payload: unknown, status: number) =>
    new Response(JSON.stringify(payload), {status, headers: {'content-type': 'application/json'}});
  if (!question) return json({error: 'A question is required.'}, 400);
  if (question.length > 500) return json({error: 'That question is too long.'}, 400);

  const failed = async (response: Response, stage: string) => {
    const detail = await response.text().catch(() => '');
    console.error(`gemma ${stage} error`, response.status, detail.slice(0, 400));
    return json({
      error: response.status === 429
        ? 'The anatomy assistant is rate limited right now. Please try again shortly.'
        : 'The anatomy assistant could not be reached.',
    }, 502);
  };

  // Stage one: what is anatomically involved, independent of this atlas.
  const proposal = await callModel(apiKey, {system: PROPOSE, user: question, schema: PROPOSE_SCHEMA, streaming: false});
  if (!proposal.ok) return failed(proposal, 'propose');
  let proposed: string[] = [];
  try {
    const payload = await proposal.json() as {candidates?: {content?: {parts?: {text?: string}[]}}[]};
    const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '{}';
    proposed = (JSON.parse(text).structures ?? []).filter((s: unknown): s is string => typeof s === 'string');
  } catch (error) {
    console.error('propose parse failed', error);
  }

  // Search the atlas for what stage one named. Anything that matches nothing is
  // known-absent, which is a measured signal rather than an observed one.
  const {rows: candidates, absent} = shortlist(rows, proposed, question);
  console.log('ask', JSON.stringify({question, proposed, absent, candidates: candidates.length}));
  if (!candidates.length) {
    return json({error: 'Nothing in this anatomy model matches that question.'}, 404);
  }

  const upstream = await callModel(apiKey, {
    system: compose(renderRows(candidates), absent),
    user: question,
    schema: SCHEMA,
    streaming: true,
  });
  if (!upstream.ok || !upstream.body) return failed(upstream, 'compose');

  const stream = new ReadableStream({
    async start(controller) {
      const encode = (text: string) => controller.enqueue(new TextEncoder().encode(text));
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '', document = '', sentScene = false;

      /** Dispatch the camera as soon as focus, systems and view have closed. */
      const trySendScene = () => {
        if (sentScene) return;
        const focus = sliceValue(document, 'focus');
        const view = document.match(/"view"\s*:\s*"([a-z-]+)"/)?.[1];
        if (!focus || !view) return;
        try {
          const partial = {
            focus: JSON.parse(focus),
            systems: JSON.parse(sliceValue(document, 'systems') ?? '[]'),
            view,
            unmodeled: [],
            answer: '',
          } as ModelScene;
          const scene = validateScene(partial, catalog);
          if (!scene.focus.length && !scene.rejected.length) return;
          scene.unmodeled = scene.unmodeled.filter((term) => !present(rows, term));
          sentScene = true;
          encode(sse('scene', scene));
        } catch { /* Still mid-token; the final parse covers it. */ }
      };

      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, {stream: true});
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === '[DONE]') continue;
            try {
              const chunk = JSON.parse(payload);
              for (const part of chunk.candidates?.[0]?.content?.parts ?? []) {
                if (typeof part.text === 'string') document += part.text;
              }
            } catch { /* Partial SSE frame; it completes on a later read. */ }
          }
          trySendScene();
        }

        const object = firstObject(document);
        if (!object) throw new Error('no JSON object in response');
        const scene: Scene = validateScene(JSON.parse(object) as ModelScene, catalog);
        // A false "not in this model" is worse than a miss, so each claim is checked.
        scene.unmodeled = scene.unmodeled.filter((term) => !present(rows, term));
        encode(sse(sentScene ? 'answer' : 'scene', scene));
      } catch (error) {
        console.error('scene assembly failed', error, document.slice(0, 300), '...TAIL...', document.slice(-200));
        encode(sse('error', {error: 'The anatomy assistant returned something unreadable. Please try again.'}));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {'content-type': 'text/event-stream', 'cache-control': 'no-cache'},
  });
}

/** Vercel serverless entry point. */
export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', {status: 405});
  const apiKey = process.env.API_KEY ?? process.env.GEMMA_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({error: 'The anatomy assistant is not configured.'}), {
      status: 500, headers: {'content-type': 'application/json'},
    });
  }
  const body = (await request.json().catch(() => ({}))) as AskBody;
  return handleAsk(body, apiKey);
}
