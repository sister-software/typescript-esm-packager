# TypeScript Path Transformer

# What is this?

`ts-path-transformer` is a TypeScript transformer that allows you to rewrite import and export paths in your TypeScript code.
This is useful if you want to rewrite file extensions, or if you want to use a different file extension for your TypeScript code.

[![npm (scoped)](https://img.shields.io/npm/v/@sister.software/ts-path-transformer)](https://www.npmjs.com/package/@sister.software/ts-path-transformer)
![npm](https://img.shields.io/npm/dm/@sister.software/ts-path-transformer)
![GitHub](https://img.shields.io/github/license/sister-software/ts-path-transformer)

- [Source Code](https://github.com/sister-software/ts-path-transformer)

## Installation

### NPM

```bash
yarn add @sister.software/ts-path-transformer
# or
npm install --save @sister.software/ts-path-transformer
```

## Usage

Ironically, this package actually uses itself to rewrite its own source code. You can find a more detailed example in the repo's build script.

Here's a quick example of how to use this package to rewrite '.mts' files to '.mjs' files:

```ts
import { readParsedTSConfig, TSPathTransformer } from '@sister.software/ts-path-transformer'

// ESM modules don't have __dirname, so we have to use import.meta.url...
const __dirname = new URL('.', import.meta.url).pathname

// Load the tsconfig.json file...
// This function is just a wrapper around TypeScript's `ts.readConfigFile` function...
const tsConfig = readParsedTSConfig(path.join(__dirname, 'tsconfig.json'))

// As of TypeScript 5, we can only use module extensions in imports and exports,
// if the compiler option `emitDeclarationOnly` is set to `true`.
// So we turn it off for the duration of the emit...
const compilerOptions: ts.CompilerOptions = {
  ...tsConfig.options,
  emitDeclarationOnly: false,
}

// Create a transformer that rewrites '.mts' files to '.mjs' files...
const transformer = new TSPathTransformer({
  '.mjs': /\.m?tsx?$/gi,
})

// Standard TypeScript boilerplate goes here...
const program = ts.createProgram({
  host: ts.createCompilerHost(tsConfig.options, true),
  options: compilerOptions,
  rootNames: tsConfig.fileNames,
})

// Finally, we emit the files...
program.emit(
  undefined,
  transformer.writeFileCallback, // We emit the files after they're transformed...
  undefined,
  undefined,
  // We pass the transformer to the compiler...
  transformer.asCustomTransformers()
)
```

Your build directory should now contain `.mjs` files instead of `.mts` files!

# License

`ts-path-transformer` is licensed under the [MIT License](https://opensource.org/licenses/MIT).

Inspiration for this project comes from Dropbox's deprecated [ts-transformer-path-rewrite](https://github.com/dropbox/ts-transform-import-path-rewrite) package 💕
