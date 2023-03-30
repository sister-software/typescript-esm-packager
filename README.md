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

Ironically, this package actually uses itself to rewrite its own source code. You can find a more detailed example in this repo's own build script.

Here's a quick example of how to use this package to rewrite '.mts' files to '.mjs' files:

```ts
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  SimpleProgramConfig,
  TSPathTransformer,
  cleanTSBuildDirectory,
  createDefaultPrettierFormatter,
  createSimpleTSProgram,
  createSimpleTSProgramWithWatcher,
  readParsedTSConfig,
} from '@sister.software/ts-path-transformer'

// ESM modules don't have __dirname, so we have to use import.meta.url...
const __dirname = path.dirname(fileURLToPath(import.meta.url))

const programConfig: SimpleProgramConfig = {
  // Load the tsconfig.json file...
  // This function is just a wrapper around TypeScript's `ts.readConfigFile` function...
  tsConfig: readParsedTSConfig(path.join(__dirname, 'tsconfig.json')),
  // Create a transformer that...
  transformer: new TSPathTransformer({
    //...Keeps declarations as '.d.mts' files:
    '.d.mts': /\.d\.mts$/gi,
    //...And rewrites '.mts' files to '.mjs' files:
    '.mjs': /\.m?tsx?$/gi,
  }),
  // Just for fun, we'll also format the output files with Prettier...
  formatter: await createDefaultPrettierFormatter(),
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

`ts-path-transformer` is licensed under the [MIT License](https://opensource.org/licenses/MIT).

Inspiration for this project comes from Dropbox's deprecated [ts-transformer-path-rewrite](https://github.com/dropbox/ts-transform-import-path-rewrite) package 💕
