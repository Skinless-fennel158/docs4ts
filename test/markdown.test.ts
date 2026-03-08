import { describe, expect, it } from "vitest";
import { renderJSDocsMarkdown, jsdocsToMarkdown } from "../src/markdown.ts";
import type { JSDocEntry } from "../src/parser.ts";

describe("renderJSDocsMarkdown", () => {
  it("renders function with params and returns", () => {
    const entries: JSDocEntry[] = [
      {
        kind: "function",
        name: "add",
        exported: true,
        description: "Add two numbers.",
        tags: [
          { tag: "param", name: "a", description: "First number" },
          { tag: "param", name: "b", type: "number", description: "Second number" },
          { tag: "returns", type: "number", description: "The sum" },
        ],
        signature: "export function add(a: number, b: number): number",
      },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("### `add`");
    expect(md).toContain("```ts\nexport function add(a: number, b: number): number\n```");
    expect(md).toContain("Add two numbers.");
    expect(md).toContain("**Parameters:**");
    expect(md).toContain("- **`a`** — First number");
    expect(md).toContain("- **`b`** `number` — Second number");
    expect(md).toContain("**Returns:** `number` — The sum");
  });

  it("renders example tag", () => {
    const entries: JSDocEntry[] = [
      {
        kind: "function",
        name: "greet",
        exported: true,
        tags: [{ tag: "example", description: 'greet("world")' }],
      },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("**Example:**");
    expect(md).toContain('```ts\ngreet("world")\n```');
  });

  it("renders example with existing code fence as-is", () => {
    const entries: JSDocEntry[] = [
      {
        kind: "function",
        name: "fn",
        exported: true,
        tags: [{ tag: "example", description: "```js\nconsole.log(1)\n```" }],
      },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("```js\nconsole.log(1)\n```");
    // Should not double-wrap
    expect(md).not.toContain("```ts\n```js");
  });

  it("renders deprecated tag", () => {
    const entries: JSDocEntry[] = [
      {
        kind: "function",
        name: "old",
        exported: true,
        description: "Old function.",
        tags: [{ tag: "deprecated", description: "Use newFn instead" }],
      },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("> **Deprecated**: Use newFn instead");
  });

  it("renders @see and @since tags", () => {
    const entries: JSDocEntry[] = [
      {
        kind: "function",
        name: "fn",
        exported: true,
        tags: [
          { tag: "see", description: "https://example.com" },
          { tag: "since", description: "2.0.0" },
        ],
      },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("**See:** https://example.com");
    expect(md).toContain("**Since:** 2.0.0");
  });

  it("renders custom tags", () => {
    const entries: JSDocEntry[] = [
      {
        kind: "function",
        name: "fn",
        exported: true,
        tags: [{ tag: "throws", description: "Error on invalid input" }],
      },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("**@throws** Error on invalid input");
  });

  it("separates multiple entries with ---", () => {
    const entries: JSDocEntry[] = [
      { kind: "function", name: "a", exported: true, tags: [] },
      { kind: "function", name: "b", exported: true, tags: [] },
    ];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toContain("---");
    expect(md).toContain("### `a`");
    expect(md).toContain("### `b`");
  });

  it("renders entry without signature or description", () => {
    const entries: JSDocEntry[] = [{ kind: "type", name: "ID", exported: true, tags: [] }];
    const md = renderJSDocsMarkdown(entries);
    expect(md).toBe("### `ID`\n");
  });

  it("returns empty string for no entries", () => {
    expect(renderJSDocsMarkdown([])).toBe("");
  });
});

describe("jsdocsToMarkdown", () => {
  it("combines extraction and rendering", () => {
    const md = jsdocsToMarkdown(`
/**
 * Add two numbers.
 * @param a - First number
 * @param b - Second number
 * @returns The sum
 * @example
 * add(1, 2) // 3
 */
export function add(a: number, b: number): number {
  return a + b;
}

/** User object. */
export interface User {
  name: string;
}
`);
    expect(md).toMatchSnapshot();
  });

  it("returns empty string for source without jsdocs", () => {
    const md = jsdocsToMarkdown(`export function noDoc() {}`);
    expect(md).toBe("");
  });
});
