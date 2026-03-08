# docs4ts

<!-- automd:badges color=yellow -->

[![npm version](https://img.shields.io/npm/v/docs4ts?color=yellow)](https://npmjs.com/package/docs4ts)
[![npm downloads](https://img.shields.io/npm/dm/docs4ts?color=yellow)](https://npm.chart.dev/docs4ts)

<!-- /automd -->

Extract JSDoc documentation from TypeScript/JavaScript source files and generate formatted Markdown. Uses [oxc-parser](https://oxc.rs) for fast, accurate parsing with automatic re-export traversal.

## CLI

```bash
# Print markdown to stdout
npx docs4ts src/index.ts

# Write to file
npx docs4ts src/index.ts -o docs/api.md
```

```
Usage: docs4ts [options] <file>

Options:
  -o, --out <file>  Write output to file
  -h, --help        Show this help
```

The CLI follows re-exports automatically — point it at your entry file and it will traverse the module graph to document all exported symbols.

## Programmatic Usage

```ts
import {
  extractJSDocs,
  parseJSDoc,
  renderJSDocsMarkdown,
  jsdocsToMarkdown,
  loadJSDocs,
} from "docs4ts";
```

### `extractJSDocs(source, options?)`

Parse a single source string and return an array of `JSDocEntry` objects.

```ts
const entries = extractJSDocs(`
  /** Add two numbers. */
  export function add(a: number, b: number): number {
    return a + b;
  }
`);
// entries[0] => { name: "add", kind: "function", description: "Add two numbers.", ... }
```

**Options:**

| Option           | Type      | Default      | Description                                 |
| ---------------- | --------- | ------------ | ------------------------------------------- |
| `filename`       | `string`  | `"input.ts"` | Filename hint for parser language detection |
| `includePrivate` | `boolean` | `false`      | Include non-exported declarations           |

### `loadJSDocs(file, options?)`

Load JSDoc entries from a file, traversing all re-exported modules.

```ts
const entries = await loadJSDocs("src/index.ts");
```

### `renderJSDocsMarkdown(entries)`

Render an array of `JSDocEntry` objects as a Markdown string.

```ts
const entries = await loadJSDocs("src/index.ts");
const markdown = renderJSDocsMarkdown(entries);
```

### `jsdocsToMarkdown(source, options?)`

Parse source and render Markdown in one step.

```ts
const markdown = jsdocsToMarkdown(`
  /** Greet someone. */
  export function greet(name: string): string {
    return "Hello, " + name;
  }
`);
```

### `parseJSDoc(comment)`

Parse a raw JSDoc comment string into structured description and tags.

```ts
const { description, tags } = parseJSDoc(`
  * Add two numbers.
  * @param a - First number
  * @param b - Second number
  * @returns The sum
`);
```

## Types

```ts
interface JSDocEntry {
  kind: "function" | "class" | "interface" | "type" | "enum" | "variable" | "method" | "property";
  name: string;
  exported: boolean;
  description?: string;
  tags: JSDocTag[];
  signature?: string;
}

interface JSDocTag {
  tag: string;
  name?: string;
  type?: string;
  description?: string;
}
```

## Development

<details>

<summary>local development</summary>

- Clone this repository
- Install latest LTS version of [Node.js](https://nodejs.org/en/)
- Enable [Corepack](https://github.com/nodejs/corepack) using `corepack enable`
- Install dependencies using `pnpm install`
- Run interactive tests using `pnpm dev`

</details>

## License

Published under the [MIT](https://github.com/pi0/docs4ts/blob/main/LICENSE) license.
