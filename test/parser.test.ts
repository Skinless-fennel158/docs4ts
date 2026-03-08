import { describe, expect, it } from "vitest";
import { extractJSDocs, parseJSDoc } from "../src/parser.ts";

describe("parseJSDoc", () => {
  it("parses description only", () => {
    const result = parseJSDoc("* Hello world");
    expect(result).toEqual({ description: "Hello world", tags: [] });
  });

  it("parses @param tags with types", () => {
    const result = parseJSDoc(`
 * Add two numbers.
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} The sum
 `);
    expect(result.description).toBe("Add two numbers.");
    expect(result.tags).toHaveLength(3);
    expect(result.tags[0]).toEqual({
      tag: "param",
      type: "number",
      name: "a",
      description: "First number",
    });
    expect(result.tags[1]).toEqual({
      tag: "param",
      type: "number",
      name: "b",
      description: "Second number",
    });
    expect(result.tags[2]).toEqual({
      tag: "returns",
      type: "number",
      description: "The sum",
    });
  });

  it("parses untyped params", () => {
    const result = parseJSDoc(`
 * @param name - The user name
 `);
    expect(result.tags[0]).toEqual({
      tag: "param",
      name: "name",
      description: "The user name",
    });
  });

  it("parses @example with code", () => {
    const result = parseJSDoc(`
 * Does stuff.
 * @example
 * const x = foo()
 * console.log(x)
 `);
    expect(result.tags[0]!.tag).toBe("example");
    expect(result.tags[0]!.description).toContain("const x = foo()");
    expect(result.tags[0]!.description).toContain("console.log(x)");
  });

  it("parses @returns without type", () => {
    const result = parseJSDoc(`
 * @returns The greeting
 `);
    expect(result.tags[0]).toEqual({
      tag: "returns",
      description: "The greeting",
    });
  });

  it("normalizes @return to @returns", () => {
    const result = parseJSDoc(`
 * @return {string} The value
 `);
    expect(result.tags[0]!.tag).toBe("returns");
  });

  it("normalizes @arg to @param", () => {
    const result = parseJSDoc(`
 * @arg {string} name - The name
 `);
    expect(result.tags[0]!.tag).toBe("param");
    expect(result.tags[0]!.name).toBe("name");
  });

  it("parses @deprecated tag", () => {
    const result = parseJSDoc(`
 * Old function.
 * @deprecated Use newFunction instead
 `);
    expect(result.description).toBe("Old function.");
    expect(result.tags[0]).toEqual({
      tag: "deprecated",
      description: "Use newFunction instead",
    });
  });

  it("parses @see and @since tags", () => {
    const result = parseJSDoc(`
 * @see https://example.com
 * @since 1.0.0
 `);
    expect(result.tags[0]).toEqual({ tag: "see", description: "https://example.com" });
    expect(result.tags[1]).toEqual({ tag: "since", description: "1.0.0" });
  });

  it("handles multi-line description", () => {
    const result = parseJSDoc(`
 * First line.
 * Second line.
 * Third line.
 `);
    expect(result.description).toBe("First line.\nSecond line.\nThird line.");
  });

  it("handles tag continuation lines", () => {
    const result = parseJSDoc(`
 * @param name - The user name
 *   which can be multi-line
 `);
    expect(result.tags[0]!.description).toBe("The user name\n  which can be multi-line");
  });

  it("parses @type tag", () => {
    const result = parseJSDoc(`
 * @type {string}
 `);
    expect(result.tags[0]).toEqual({ tag: "type", type: "string" });
  });

  it("returns undefined description when empty", () => {
    const result = parseJSDoc(`
 * @param x - value
 `);
    expect(result.description).toBeUndefined();
  });
});

describe("extractJSDocs", () => {
  it("extracts exported function with jsdoc", () => {
    const source = `
/** Add two numbers. */
export function add(a: number, b: number): number {
  return a + b;
}
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("add");
    expect(entries[0]!.kind).toBe("function");
    expect(entries[0]!.exported).toBe(true);
    expect(entries[0]!.description).toBe("Add two numbers.");
  });

  it("extracts exported interface", () => {
    const source = `
/** User object. */
export interface User {
  name: string;
  age: number;
}
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("User");
    expect(entries[0]!.kind).toBe("interface");
  });

  it("extracts exported type alias", () => {
    const source = `
/** ID type. */
export type ID = string | number;
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("ID");
    expect(entries[0]!.kind).toBe("type");
  });

  it("extracts exported enum", () => {
    const source = `
/** Direction enum. */
export enum Direction {
  Up,
  Down,
}
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("Direction");
    expect(entries[0]!.kind).toBe("enum");
  });

  it("extracts exported class", () => {
    const source = `
/** A logger. */
export class Logger {
  log(msg: string) {}
}
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("Logger");
    expect(entries[0]!.kind).toBe("class");
  });

  it("extracts exported variable", () => {
    const source = `
/** Default timeout. */
export const TIMEOUT = 5000;
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("TIMEOUT");
    expect(entries[0]!.kind).toBe("variable");
  });

  it("skips non-exported by default", () => {
    const source = `
/** Internal helper. */
function helper() {}

/** Public API. */
export function api() {}
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("api");
  });

  it("includes non-exported with includePrivate", () => {
    const source = `
/** Internal. */
function helper() {}
`;
    const entries = extractJSDocs(source, { includePrivate: true });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("helper");
    expect(entries[0]!.exported).toBe(false);
  });

  it("extracts params and tags from jsdoc", () => {
    const source = `
/**
 * Greet someone.
 * @param name - The person's name
 * @returns A greeting string
 */
export function greet(name: string): string {
  return \`Hello \${name}\`;
}
`;
    const entries = extractJSDocs(source);
    expect(entries[0]!.tags).toHaveLength(2);
    expect(entries[0]!.tags[0]!.tag).toBe("param");
    expect(entries[0]!.tags[0]!.name).toBe("name");
    expect(entries[0]!.tags[1]!.tag).toBe("returns");
  });

  it("extracts signature for function", () => {
    const source = `
/** Do something. */
export function doSomething(a: string, b: number): void {
  console.log(a, b);
}
`;
    const entries = extractJSDocs(source);
    expect(entries[0]!.signature).toContain("function doSomething");
    expect(entries[0]!.signature).not.toContain("{");
  });

  it("strips _-prefixed generic type params from signature", () => {
    const source = `
/** Get query. */
export function getQuery<
  T,
  Event extends H3Event | HTTPEvent = HTTPEvent,
  _T = Exclude<InferEventInput<"query", Event, T>, undefined>,
>(event: Event): _T {}
`;
    const entries = extractJSDocs(source);
    expect(entries[0]!.signature).toContain("<");
    expect(entries[0]!.signature).toContain("T,");
    expect(entries[0]!.signature).not.toContain("_T =");
  });

  it("removes entire generic section when all params are private", () => {
    const source = `
/** Internal. */
export function foo<_A, _B>(x: string): void {}
`;
    const entries = extractJSDocs(source);
    expect(entries[0]!.signature).not.toContain("<");
    expect(entries[0]!.signature).toContain("foo(x: string)");
  });

  it("handles multiple exports", () => {
    const source = `
/** First. */
export function first() {}

/** Second. */
export function second() {}

/** Third. */
export type Third = string;
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(3);
    expect(entries.map((e) => e.name)).toEqual(["first", "second", "Third"]);
  });

  it("skips exported declarations without jsdoc", () => {
    const source = `
export function noDoc() {}

/** Has doc. */
export function hasDoc() {}
`;
    const entries = extractJSDocs(source);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("hasDoc");
  });

  it("respects filename option for language detection", () => {
    const source = `
/** Pure JS. */
export function hello() {}
`;
    const entries = extractJSDocs(source, { filename: "input.js" });
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("hello");
  });
});
