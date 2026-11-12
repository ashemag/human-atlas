import type { Atlas, Concept } from "./anatomy";
import { searchText, normalizeSearch } from "../../client/i18n/index.ts";
type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute: (input: unknown) => unknown;
};
function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Expected an object.");
  return input as Record<string, unknown>;
}
export function atlasTools(atlas: Atlas, inspect: (concept: Concept) => void): Tool[] {
  return [
    {
      name: "find_anatomy",
      description: "Find anatomical structures by name or source atlas identifier in this atlas.",
      inputSchema: {
        type: "object",
        properties: { query: { type: "string", minLength: 1 } },
        required: ["query"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        const data = record(input);
        if (typeof data.query !== "string" || !data.query.trim())
          throw new Error("A nonempty query is required.");
        const q = normalizeSearch(data.query);
        return atlas.concepts
          .filter((c) => searchText(c.name, c.id).includes(q))
          .slice(0, 30)
          .map((c) => ({ id: c.id, name: c.name, pieces: c.elements.length }));
      },
    },
    {
      name: "inspect_anatomical_structure",
      description: "Select an atlas concept in the 3D anatomy and open its visible detail panel.",
      inputSchema: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        const data = record(input);
        if (typeof data.id !== "string") throw new Error("An atlas identifier is required.");
        const concept = atlas.concepts.find((c) => c.id === data.id);
        if (!concept) throw new Error("That structure is not present in this atlas.");
        inspect(concept);
        return { id: concept.id, name: concept.name, selectedPieces: concept.elements.length };
      },
    },
  ];
}
export function registerAtlasTools(atlas: Atlas, inspect: (concept: Concept) => void) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  for (const tool of atlasTools(atlas, inspect)) {
    try {
      void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(
        () => {},
      );
    } catch {
      /* Optional browser capability; the visible UI remains available. */
    }
  }
  return () => lifecycle.abort();
}
