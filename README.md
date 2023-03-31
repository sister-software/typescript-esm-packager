# Typescript ESM Packager

A collection of tools to build ESM packages with TypeScript.

[![npm (scoped)](https://img.shields.io/npm/v/@sister.software/typescript-esm-packager)](https://www.npmjs.com/package/@sister.software/typescript-esm-packager)
![npm](https://img.shields.io/npm/dm/@sister.software/typescript-esm-packager)
![GitHub](https://img.shields.io/github/license/sister-software/typescript-esm-packager)

- [Source Code](https://github.com/sister-software/typescript-esm-packager)

## Why would I need this?

If you're building a library that you want to publish to NPM, you'll probably want to publish it as an ESM module. And you'll probably want to write it in TypeScript because maintaining untyped JavaScript is a nightmare.

But this is a lot of work, and it's easy to get it wrong. This package is a collection of tools that will help you get it right.

Let's talk about what a **Good Package** looks like...

### Entirely written as ESM modules

`require/exports` is dead. Long live `import/export`! ESM modules are supported in all modern JavaScript runtimes such as Node, Deno, and the browser.

This means that all of our files should have the `.mjs` extension, and the type declarations should have the `.d.mts` extension. It also means that we should be able to import our files using the `import` keyword, and we should be able to export our files using the `export` keyword.

Personally, I'm mildly-annoyed about the `.mjs` extension. But we're here and have other things to worry about, so let's move on...

You also don't want to be that developer who releases their package with busted type definitions, or forces everyone to use `allowSyntheticDefaultImports` in their `tsconfig.json` file.

You want to be the developer who releases a package that Just Works™️.

ESM everywhere. All the time.

### Debuggable

If you're building a library, you want your users to be able to debug your library. This means shipping type-declarations and source maps.

And if you're working with an organization that has a specific style guide, it means shipping your source code in a format that matches that style guide.
It's not fun trying to debug a library while your editor's linter lights up like a Christmas tree.

### Compatible with Node's package.json `exports` field

The `exports` field in `package.json` allows you to specify which files in your package are accessible to users of your package. This is useful if you want to hide implementation details from your users.

Here's the bare minimum that you should have in your `package.json` file:

```jsonc
{
  "name": "my-awesome-package",
  // Tell Node that we're an ESM module.
  "type": "module",
  // Some tools still depend on the `main` field...
  "main": "./dist/mod.mjs",
  // Older versions of TypeScript still depend on the `types` field...
  "types": "./dist/mod.d.mts",
  "exports": {
    // Expose the `package.json` to make everyone's lives easier...
    "./package.json": "./package.json",
    // Expose `import { foo } from "my-awesome-package"`
    ".": {
      "import": "./dist/mod.mjs",
      "types": "./dist/mod.d.mts"
    },
    // Let users import `my-awesome-package/mod` to get the specific file.
    "./mod": {
      "import": "./dist/mod.mjs",
      "types": "./dist/mod.d.mts"
    },
    // Same as above, but with allowing users to access the `.mjs` extension.
    "./mod.mjs": {
      "import": "./dist/mod.mjs",
      "types": "./dist/mod.d.mts"
    }
  }
}
```

We use `mod` rather than `index` because Node does all sorts of magic to make `index` files work. We don't want that magic, to interfere with understanding exactly what's going on. If you use `index` files and later have to debug your package in the browser, it will be a nightmare.

### Browser-compatible

A well formed NPM package should be able to be used in the browser with little to no effort. This means that we should be able to import our package using a `<script type="module">` tag. No bundlers, no build steps, no nothing.

Some of Node's built in modules, such as `fs`, do not have browser equivalents.
That's okay, but you should separate these exports into their own module so that your users can import them separately:

```ts
// file-loaders/node.mjs

// Prefix with `node:` to clue users in that this is a Node-specific module.
// TypeScript understands this syntax and will not complain about missing types.
import * as path from 'node:path'
import * as fs from 'node:fs/promises'

export function loadSomeFile() {
  // ...
}
```

```ts
// file-loaders/browser.mjs

export function loadSomeFile() {
  fetch('/some-file.json')
    .then((response) => response.json())
    .then((data) => {
      // ...
    })
}
```

Just make sure that you don't accidentally import the Node-specific module in the browser, or vice versa. You'll also need to update your package.json `exports` to exposes a `mod.mjs` file for each of these.

### Bundler-compatible

**If you're building a library, your users shouldn't have to use a bundler to use your library.**

However, if your users do want to use a bundler, this requires no extra effort on your part. As long as your distributed package is unbundled, your users can use a bundler to bundle your package.

Let your users bring a bundler if they want to take advantage of tree-shaking, minification, etc.

### Deno-compatible

This is less important than the other points, but it's place of confusion for a lot of developers. Deno uses ESM modules, however it largely ignores the package.json config for a import-map approach. It's honestly a bit of a mess, but here's the important part:

```ts
import { foo } from 'https://deno.land/x/my-awesome-package/mod.mts'
import { someLocalFile } from './some-local-file.mts'
import { SomeReactComponent } from './some-local-file.tsx'
```

Deno expects fully qualified URLs for remote modules, and relative paths for local modules. It also expects the `.mts` extension for TypeScript files, and the `.tsx` extension for TypeScript JSX files.

**This is where things get horrible.**

Your project's `tsconfig.json` defines how TypeScript _compiles_ your code. It does not define how TypeScript _emits_ your code. The TypeScript team does not want to get into the business of rewriting import paths file extensions.

This means that your only option was to either omit file extensions on your imports and exports, or set `module: "esnext"` in your `tsconfig.json` file:

```ts
// Meanwhile, in mod.mts...
import { someLocalFile } from './some-local-file.mjs' // WTF???
import { SomeReactComponent } from './some-local-file' // Why no file extension?
```

The short-version of what's going on is that TypeScript will output exports exactly as written, but will only _resolve_ them using the `module` setting in your `tsconfig.json` file. The JSX thing is a weird bug because there's no such thing as `.mtsx` or `.mjsx` files. And until TypeScript 5, it wasn't possible to include uncompiled file extensions in your TypeScript code.

**You've just discovered why you might need this package. 🎉**

## Installation

### NPM

```bash
yarn add @sister.software/typescript-esm-packager
# or
npm install --save @sister.software/typescript-esm-packager
```

## Usage

Ironically, this package actually uses itself to rewrite its own source code. You can find a more detailed example in this repo's own build script.

Here's a quick example of how to use this package to rewrite `'.mts'` files to `'.mjs'` files:

```ts
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SimpleProgramConfig,
  TSPathTransformer,
  cleanTSBuildDirectory,
  createPrettierWriteFileCallback,
  createSimpleTSProgram,
  createSimpleTSProgramWithWatcher,
  readParsedTSConfig,
} from '@sister.software/typescript-esm-packager'

// ESM modules don't have __dirname, so we have to use import.meta.url...
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const programConfig: SimpleProgramConfig = {
  // Load the tsconfig.json file...
  // This function is just a wrapper around TypeScript's `ts.readConfigFile` function...
  tsConfig: readParsedTSConfig(path.join(__dirname, 'tsconfig.json')),
  // Create a transformer that...
  transformer: new TSPathTransformer({
    //...Rewrites '.ts', '.mts', and '.tsx' files to '.mjs' files:
    '.mjs': /\.m?tsx?$/gi,
  }),
  // Just for fun, we'll also format the output files with Prettier...
  writeFileCallback: await createPrettierWriteFileCallback(),
}

// Clear out any previous builds...
await cleanTSBuildDirectory(programConfig.tsConfig)

const watch = process.argv.includes('--watch')

if (watch) {
  // Create a program that watches for changes and re-emits the files...
  createSimpleTSProgramWithWatcher(programConfig)
} else {
  // Or, create a program that emits the files once...
  const program = createSimpleTSProgram(programConfig)

  program.emitWithTransformer()
}
```

Your build directory should now contain `.mjs` files instead of `.mts` files!

# License

`@sister.software/typescript-esm-packager` is licensed under the [MIT License](https://opensource.org/licenses/MIT).

Inspiration for this project comes from Dropbox's deprecated [ts-transformer-path-rewrite](https://github.com/dropbox/ts-transform-import-path-rewrite) package 💕
