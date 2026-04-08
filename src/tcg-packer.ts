import { readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import JSZip from 'jszip';
import { validateTcgArchive } from './tcg-validator.js';

/**
 * Recursively add all files from a directory to a JSZip instance.
 */
async function addDirToZip(zip: JSZip, dir: string, zipPrefix: string): Promise<number> {
  let count = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    const zipPath  = zipPrefix + entry.name;
    if (entry.isDirectory()) {
      count += await addDirToZip(zip, fullPath, zipPath + '/');
    } else {
      const data = await readFile(fullPath);
      zip.file(zipPath, data);
      count++;
    }
  }
  return count;
}

/**
 * Pack a TCG source folder into a .tcg ZIP archive buffer.
 * Validates the archive structure before returning.
 *
 * @param sourceDir - Path to the source folder containing cards.json, img/, etc.
 * @returns The packed archive as a Buffer.
 * @throws If the source folder does not exist or the archive fails validation.
 */
export async function packTcgArchiveToBuffer(sourceDir: string): Promise<Buffer> {
  // Validate folder exists
  try {
    await stat(sourceDir);
  } catch {
    throw new Error(`Source folder not found: ${sourceDir}`);
  }

  // Pack folder into ZIP
  const zip = new JSZip();
  const count = await addDirToZip(zip, sourceDir, '');

  if (count === 0) {
    throw new Error(`Source folder is empty: ${sourceDir}`);
  }

  // Ensure img/ directory always exists in archive (required by validator)
  const hasImgFolder = Object.keys(zip.files).some(f => f.startsWith('img/'));
  if (!hasImgFolder) zip.folder('img');

  // Validate the packed archive
  const result = await validateTcgArchive(zip);
  if (!result.valid) {
    throw new Error(`Archive validation failed:\n${result.errors.join('\n')}`);
  }

  return await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) as Buffer;
}

/**
 * Pack a TCG source folder into a .tcg ZIP archive and write it to disk.
 *
 * @param sourceDir - Path to the source folder containing cards.json, img/, etc.
 * @param outputPath - Path where the .tcg file will be written.
 * @throws If the source folder does not exist or the archive fails validation.
 */
export async function packTcgArchive(sourceDir: string, outputPath: string): Promise<void> {
  const buffer = await packTcgArchiveToBuffer(sourceDir);
  await writeFile(outputPath, buffer);
}
