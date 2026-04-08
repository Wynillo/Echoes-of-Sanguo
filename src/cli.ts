#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { loadTcgFile } from './tcg-loader.js';
import { packTcgArchive } from './tcg-packer.js';

const HELP = `
tcg-format — Echoes of Sanguo TCG archive tool

Usage:
  tcg-format validate <dir>           Validate a .tcg source folder
  tcg-format pack <dir> -o <file>     Pack a source folder into a .tcg archive
  tcg-format inspect <file>           Print summary of a .tcg archive
  tcg-format --help                   Show this help message

Options:
  -o, --output <file>   Output path for pack command
  --lang <code>         Language code for inspect (e.g. 'en', 'de')
  -h, --help            Show help
`.trim();

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP);
    process.exit(0);
  }

  const command = args[0];
  const rest = args.slice(1);

  switch (command) {
    case 'validate':
      await cmdValidate(rest);
      break;
    case 'pack':
      await cmdPack(rest);
      break;
    case 'inspect':
      await cmdInspect(rest);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.log(HELP);
      process.exit(1);
  }
}

async function cmdValidate(args: string[]) {
  if (args.length === 0) {
    console.error('Usage: tcg-format validate <dir>');
    process.exit(1);
  }

  const dir = resolve(args[0]);

  // Pack to buffer (which includes validation) — if it succeeds, the folder is valid
  const { packTcgArchiveToBuffer } = await import('./tcg-packer.js');
  try {
    await packTcgArchiveToBuffer(dir);
    console.log(`Valid .tcg source folder: ${dir}`);
  } catch (e) {
    console.error(`Validation failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

async function cmdPack(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0 || !values.output) {
    console.error('Usage: tcg-format pack <dir> -o <file>');
    process.exit(1);
  }

  const dir = resolve(positionals[0]);
  const output = resolve(values.output);

  try {
    await packTcgArchive(dir, output);
    console.log(`Packed ${dir} → ${output}`);
  } catch (e) {
    console.error(`Pack failed: ${e instanceof Error ? e.message : e}`);
    process.exit(1);
  }
}

async function cmdInspect(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    options: {
      lang: { type: 'string', default: '' },
    },
    allowPositionals: true,
  });

  if (positionals.length === 0) {
    console.error('Usage: tcg-format inspect <file>');
    process.exit(1);
  }

  const filePath = resolve(positionals[0]);
  const buf = await readFile(filePath);
  const result = await loadTcgFile(buf.buffer as ArrayBuffer, { lang: values.lang });

  console.log(`Archive: ${filePath}`);
  if (result.manifest) {
    console.log(`  Format Version: ${result.manifest.formatVersion}`);
    if (result.manifest.name) console.log(`  Name: ${result.manifest.name}`);
    if (result.manifest.author) console.log(`  Author: ${result.manifest.author}`);
  }
  console.log(`  Cards: ${result.cards.length}`);
  console.log(`  Images: ${result.rawImages.size}`);
  console.log(`  Locales: ${[...result.localeOverrides.keys()].map(k => k || '(default)').join(', ')}`);
  if (result.opponents) console.log(`  Opponents: ${result.opponents.length}`);
  if (result.fusionFormulas) console.log(`  Fusion Formulas: ${result.fusionFormulas.length}`);
  if (result.meta?.fusionRecipes) console.log(`  Fusion Recipes: ${result.meta.fusionRecipes.length}`);
  if (result.shopData) console.log(`  Shop: yes`);
  if (result.campaignData) console.log(`  Campaign Chapters: ${result.campaignData.chapters.length}`);
  if (result.rules) console.log(`  Rules: yes`);
  if (result.typeMeta) {
    const parts: string[] = [];
    if (result.typeMeta.races) parts.push(`${result.typeMeta.races.length} races`);
    if (result.typeMeta.attributes) parts.push(`${result.typeMeta.attributes.length} attributes`);
    if (result.typeMeta.cardTypes) parts.push(`${result.typeMeta.cardTypes.length} card types`);
    if (result.typeMeta.rarities) parts.push(`${result.typeMeta.rarities.length} rarities`);
    if (parts.length) console.log(`  Type Meta: ${parts.join(', ')}`);
  }
  if (result.warnings.length > 0) {
    console.log(`  Warnings (${result.warnings.length}):`);
    for (const w of result.warnings) console.log(`    - ${w}`);
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
