// Explicit, offline import. Private originals and reference material never enter public/.
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const project = resolve(import.meta.dirname, '..');
const source = resolve(process.argv[2] || join(project, '../posing-guide/01-posen'));
const output = join(project, 'public/images/posing-guide');
await mkdir(output, { recursive: true });
const cards = [];
const publicTitles = { '039': 'Huckepack', '044': 'Auf den Armen von vorn', '045': 'Auf den Armen von hinten' };
for (const folder of (await readdir(source)).filter(name => /^\d{3}-/.test(name)).sort()) {
  const record = JSON.parse(await readFile(join(source, folder, 'pose.json'), 'utf8'));
  if (!/^zeichnung-v\d+\.png$/.test(record.image)) throw Error(`Unexpected image for ${folder}`);
  const original = await readFile(join(source, folder, record.image));
  const hash = createHash('sha256').update(original).digest('hex').slice(0, 12);
  const basename = `${record.id}-${record.slug}-${hash}`;
  const { width, height } = await sharp(original).metadata();
  for (const size of [640, 960]) {
    await sharp(original).resize({ width: size, withoutEnlargement: true }).webp({ quality: 82, effort: 5 }).toFile(join(output, `${basename}-${size}.webp`));
    await sharp(original).resize({ width: size, withoutEnlargement: true }).avif({ quality: 55, effort: 5 }).toFile(join(output, `${basename}-${size}.avif`));
  }
  // Only this explicit allowlist is suitable for the public site.
  cards.push({ ...Object.fromEntries(['id', 'slug', 'title', 'location', 'description', 'camera', 'attention', 'variation'].map(key => [key, record[key] || ''])),
    title: publicTitles[record.id] || record.title,
    legend: record.legend || [], alt: `Posing-Illustration: ${publicTitles[record.id] || record.title}.`, width, height,
    image: `/images/posing-guide/${basename}` });
}
if (cards.length !== 45 || new Set(cards.map(card => card.id)).size !== 45) throw Error('Expected the reviewed set of 45 illustrations.');
await writeFile(join(project, 'src/data/posing-guide-cards.json'), JSON.stringify(cards, null, 2) + '\n');
console.log(`${cards.length} illustrations prepared as responsive WebP/AVIF; no private reference data copied.`);
