import { parseSync, Visitor } from "oxc-parser";

/** Parsed JSDoc tag (e.g. `@param`, `@returns`, `@example`). */
export interface JSDocTag {
  /** Tag name without `@` prefix (e.g. `"param"`, `"returns"`) */
  tag: string;
  /** Parameter or symbol name (for `@param`, `@typedef`, etc.) */
  name?: string;
  /** Type annotation from `{type}` syntax */
  type?: string;
  /** Tag description text */
  description?: string;
}

/** A single documented declaration extracted from source code. */
export interface JSDocEntry {
  /** Declaration kind */
  kind: "function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "property";
  /** Declaration name */
  name: string;
  /** Whether the declaration is exported */
  exported: boolean;
  /** JSDoc description (text before any tags) */
  description?: string;
  /** JSDoc tags (@param, @returns, etc.) */
  tags: JSDocTag[];
  /** Raw source text of the declaration (signature only) */
  signature?: string;
}

/** Options for {@link extractJSDocs}. */
export interface ExtractJSDocsOptions {
  /** Filename hint for parser language detection (default: "input.ts") */
  filename?: string;
  /** Include non-exported declarations (default: false) */
  includePrivate?: boolean;
}

/**
 * Extract JSDoc entries from TypeScript/JavaScript source code.
 *
 * Parses the source with `oxc-parser`, matches JSDoc block comments to
 * their associated declarations by byte position, and returns structured entries.
 *
 * @param source - Source code string to parse
 * @param options - Parser options (filename hint, include private declarations)
 * @returns Array of extracted JSDoc entries for documented declarations
 */
export function extractJSDocs(source: string, options?: ExtractJSDocsOptions): JSDocEntry[] {
  const filename = options?.filename ?? "input.ts";
  const includePrivate = options?.includePrivate ?? false;

  const result = parseSync(filename, source);
  const comments = result.comments;
  const entries: JSDocEntry[] = [];

  // Build sorted JSDoc comment index for fast lookup
  const jsdocComments = comments
    .filter((c) => c.type === "Block" && c.value.startsWith("*"))
    .sort((a, b) => a.end - b.end);

  function findJSDoc(nodeStart: number): string | undefined {
    // Binary search for the closest JSDoc comment before nodeStart
    let lo = 0;
    let hi = jsdocComments.length - 1;
    let candidate: (typeof jsdocComments)[number] | undefined;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (jsdocComments[mid]!.end <= nodeStart) {
        candidate = jsdocComments[mid];
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    if (!candidate) return undefined;

    // Only whitespace/newlines between comment end and node start
    const between = source.slice(candidate.end, nodeStart);
    if (/^\s*$/.test(between)) {
      return candidate.value;
    }
    return undefined;
  }

  function extractSignature(start: number, end: number): string {
    const text = source.slice(start, end);
    // For functions/methods: up to the opening brace
    const braceIdx = text.indexOf("{");
    let sig: string;
    if (braceIdx > 0) {
      sig = text.slice(0, braceIdx).trimEnd();
    } else {
      // For interfaces/types: first line or up to brace
      sig = text.split("\n")[0]!.trimEnd();
    }
    return stripPrivateTypeParams(sig);
  }

  // Track which nodes are inside export declarations
  const exportedRanges: Array<{ start: number; end: number }> = [];

  function isExported(nodeStart: number): boolean {
    return exportedRanges.some((r) => nodeStart >= r.start && nodeStart <= r.end);
  }

  function addEntry(
    kind: JSDocEntry["kind"],
    name: string,
    jsdocStart: number,
    nodeStart: number,
    nodeEnd: number,
    exported: boolean,
  ): void {
    if (!exported && !includePrivate) return;
    const raw = findJSDoc(jsdocStart);
    if (!raw && !includePrivate) return;

    const parsed = raw ? parseJSDoc(raw) : { description: undefined, tags: [] };
    entries.push({
      kind,
      name,
      exported,
      ...(parsed.description ? { description: parsed.description } : {}),
      tags: parsed.tags,
      signature: extractSignature(nodeStart, nodeEnd),
    });
  }

  const visitor = new Visitor({
    ExportNamedDeclaration(node: any) {
      if (node.declaration) {
        exportedRanges.push({
          start: node.declaration.start,
          end: node.declaration.end,
        });
      }
    },
    ExportDefaultDeclaration(node: any) {
      if (node.declaration) {
        exportedRanges.push({
          start: node.declaration.start,
          end: node.declaration.end,
        });
      }
    },
  });
  visitor.visit(result.program);

  // Second pass: collect declarations
  const collector = new Visitor({
    FunctionDeclaration(node: any) {
      if (!node.id?.name) return;
      const exported = isExported(node.start);
      const jsdocStart = exported ? (findExportStart(node.start) ?? node.start) : node.start;
      addEntry("function", node.id.name, jsdocStart, node.start, node.end, exported);
    },
    ClassDeclaration(node: any) {
      if (!node.id?.name) return;
      const exported = isExported(node.start);
      const jsdocStart = exported ? (findExportStart(node.start) ?? node.start) : node.start;
      addEntry("class", node.id.name, jsdocStart, node.start, node.end, exported);
    },
    TSInterfaceDeclaration(node: any) {
      const exported = isExported(node.start);
      const jsdocStart = exported ? (findExportStart(node.start) ?? node.start) : node.start;
      addEntry("interface", node.id.name, jsdocStart, node.start, node.end, exported);
    },
    TSTypeAliasDeclaration(node: any) {
      const exported = isExported(node.start);
      const jsdocStart = exported ? (findExportStart(node.start) ?? node.start) : node.start;
      addEntry("type", node.id.name, jsdocStart, node.start, node.end, exported);
    },
    TSEnumDeclaration(node: any) {
      const exported = isExported(node.start);
      const jsdocStart = exported ? (findExportStart(node.start) ?? node.start) : node.start;
      addEntry("enum", node.id.name, jsdocStart, node.start, node.end, exported);
    },
    VariableDeclaration(node: any) {
      const exported = isExported(node.start);
      const jsdocStart = exported ? (findExportStart(node.start) ?? node.start) : node.start;
      for (const decl of node.declarations) {
        if (decl.id?.type === "Identifier" || decl.id?.name) {
          addEntry("variable", decl.id.name, jsdocStart, node.start, node.end, exported);
        }
      }
    },
  });
  collector.visit(result.program);

  function findExportStart(declStart: number): number | undefined {
    // Find the export keyword position for a declaration
    const before = source.slice(0, declStart);
    const match = before.match(/export\s+(default\s+)?$/);
    if (match) {
      return declStart - match[0].length;
    }
    return undefined;
  }

  return entries;
}

/**
 * Parse raw JSDoc comment content into description and tags.
 *
 * Expects the inner content of a `/** ... *​/` block (without the delimiters).
 * Splits the comment into a leading description and structured `@tag` entries.
 *
 * @param raw - Raw JSDoc comment body (the text between `/**` and `*​/`)
 * @returns Parsed description and array of tags
 */
export function parseJSDoc(raw: string): {
  description?: string;
  tags: JSDocTag[];
} {
  // Clean up: remove leading * from each line
  const lines = raw.split("\n").map((line) => line.replace(/^\s*\*\s?/, "").trimEnd());

  // Remove empty first/last lines (from /** and */)
  if (lines.length > 0 && lines[0]!.trim() === "") lines.shift();
  if (lines.length > 0 && lines.at(-1)!.trim() === "") lines.pop();

  const descLines: string[] = [];
  const tags: JSDocTag[] = [];
  let currentTag: JSDocTag | undefined;

  for (const line of lines) {
    const tagMatch = line.match(/^@(\w+)\s*(.*)/);
    if (tagMatch) {
      if (currentTag) tags.push(currentTag);
      currentTag = parseTagLine(tagMatch[1]!, tagMatch[2]!);
    } else if (currentTag) {
      // Continuation line for current tag
      currentTag.description = currentTag.description ? `${currentTag.description}\n${line}` : line;
    } else {
      descLines.push(line);
    }
  }
  if (currentTag) tags.push(currentTag);

  const description = descLines.join("\n").trim() || undefined;
  return { description, tags };
}

// --- Internal helpers ---

/**
 * Remove generic type parameters whose name starts with `_` (internal params).
 */
function stripPrivateTypeParams(sig: string): string {
  // Find the generic params section: first `<` ... matching `>`
  const openIdx = sig.indexOf("<");
  if (openIdx === -1) return sig;

  // Find matching closing `>`
  let depth = 0;
  let closeIdx = -1;
  for (let i = openIdx; i < sig.length; i++) {
    if (sig[i] === "<") depth++;
    else if (sig[i] === ">") {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx === -1) return sig;

  const inner = sig.slice(openIdx + 1, closeIdx);

  // Split by top-level commas (respecting `<>` nesting)
  const params: string[] = [];
  let current = "";
  depth = 0;
  for (const ch of inner) {
    if (ch === "<") depth++;
    else if (ch === ">") depth--;
    if (ch === "," && depth === 0) {
      params.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  params.push(current);

  // Filter out params starting with `_`
  const filtered = params.filter((p) => !p.trimStart().startsWith("_"));

  if (filtered.length === params.length) return sig; // nothing removed
  if (filtered.length === 0) {
    // All type params were private — remove the entire `<...>` section
    return sig.slice(0, openIdx) + sig.slice(closeIdx + 1);
  }

  return sig.slice(0, openIdx + 1) + filtered.join(",") + sig.slice(closeIdx);
}

function parseTagLine(tag: string, rest: string): JSDocTag {
  // @param {type} name - description
  // @param name - description
  // @returns {type} description
  // @example \n code...
  if (tag === "param" || tag === "arg" || tag === "argument") {
    const typed = rest.match(/^\{([^}]+)\}\s*([\w$.[\]]+)?\s*[-–—]?\s*(.*)/);
    if (typed) {
      return {
        tag: "param",
        type: typed[1],
        name: typed[2],
        description: typed[3] || undefined,
      };
    }
    const untyped = rest.match(/^([\w$.[\]]+)\s*[-–—]?\s*(.*)/);
    if (untyped) {
      return {
        tag: "param",
        name: untyped[1],
        description: untyped[2] || undefined,
      };
    }
  }

  if (tag === "returns" || tag === "return") {
    const typed = rest.match(/^\{([^}]+)\}\s*(.*)/);
    if (typed) {
      return {
        tag: "returns",
        type: typed[1],
        description: typed[2] || undefined,
      };
    }
    return { tag: "returns", description: rest || undefined };
  }

  if (tag === "type" || tag === "typedef" || tag === "template") {
    const typed = rest.match(/^\{([^}]+)\}\s*(.*)/);
    if (typed) {
      return { tag, type: typed[1], description: typed[2] || undefined };
    }
  }

  return { tag, description: rest || undefined };
}
