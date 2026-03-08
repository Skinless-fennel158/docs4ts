# oxc-parser Usage

TypeScript/JavaScript parser from [oxc.rs](https://oxc.rs/docs/guide/usage/parser). Used for JSDoc extraction.

## API

```ts
import { parseSync, Visitor } from "oxc-parser";

const result = parseSync(filename, sourceText, options?);
result.program;   // ESTree-conformant AST
result.comments;  // Array<{ type: "Line" | "Block", value: string, start: number, end: number }>
result.errors;    // Parse errors
```

### Options

```ts
interface ParserOptions {
  lang?: "js" | "jsx" | "ts" | "tsx" | "dts"; // inferred from filename
  sourceType?: "script" | "module"; // default: "module"
  range?: boolean; // [start, end] on nodes
}
```

### Comments are NOT attached to AST nodes

Comments are returned as a flat array. To associate JSDoc with declarations, match by position: a `Block` comment where `value.startsWith("*")` whose `.end` is immediately before the declaration's `.start` (only whitespace between).

For exported declarations, the JSDoc comment precedes the `export` keyword, not the declaration itself. So match against the `export` position.

### Visitor

```ts
const visitor = new Visitor({
  FunctionDeclaration(node) {
    /* node.id.name, node.start, node.end */
  },
  ClassDeclaration(node) {},
  TSInterfaceDeclaration(node) {},
  TSTypeAliasDeclaration(node) {},
  TSEnumDeclaration(node) {},
  VariableDeclaration(node) {
    /* node.declarations[].id.name */
  },
  ExportNamedDeclaration(node) {
    /* node.declaration */
  },
  ExportDefaultDeclaration(node) {},
});
visitor.visit(result.program);
```

### Key node shapes

All nodes have `{ start: number, end: number }` (byte offsets in source).

- `FunctionDeclaration`: `{ id: { name }, params, returnType, async, generator }`
- `ClassDeclaration`: `{ id: { name }, superClass, body }`
- `TSInterfaceDeclaration`: `{ id: { name }, extends, body }`
- `TSTypeAliasDeclaration`: `{ id: { name }, typeAnnotation }`
- `TSEnumDeclaration`: `{ id: { name }, body, const }`
- `VariableDeclaration`: `{ kind, declarations: [{ id: { name } }] }`
- `ExportNamedDeclaration`: `{ declaration }` — wraps the inner declaration
