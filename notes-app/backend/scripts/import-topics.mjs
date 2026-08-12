// Reusable importer: turns a JSON file of {module, topics:[{title, images, notes, keyConcepts, codeNotes, flashcards}]}
// into a real module + topics + TopicData docs in MongoDB. This is the "mechanical" half of the
// screenshot -> notes pipeline — it does no AI work itself. Any agent (Claude, Antigravity, Gemini,
// a human) that can produce the JSON shape described in PLAYBOOK.md can drive this script.
//
// Usage:
//   node import-topics.mjs <content.json> --images-dir "<folder screenshots live in>" --course "web development"
//
// content.json shape:
// {
//   "module": "Some Module Title",   // optional: forces ALL topics into this one module.
//                                    // Set to null/omit to group by each topic's own "module".
//   "topics": [
//     {
//       "module": "Sorting",                                  // used when top-level "module" is null
//       "title": "Merge Sort",
//       "images": ["Screenshot 1.png", "Screenshot 2.png"],   // filenames, resolved against --images-dir
//       "notes": "markdown prose...",
//       "keyConcepts": "- bullet\n- bullet",
//       "codeNotes": "code...",
//       "flashcards": [{ "front": "...", "back": "..." }]
//     }
//   ]
// }

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Course from '../models/Course.js';
import TopicData from '../models/TopicData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      args[a.slice(2)] = argv[i + 1];
      i++;
    } else {
      args._.push(a);
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const contentPath = args._[0];
const imagesDir = args['images-dir'];
const courseTitle = args['course'];

if (!contentPath || !imagesDir || !courseTitle) {
  console.error('Usage: node import-topics.mjs <content.json> --images-dir "<folder>" --course "<course title>"');
  process.exit(1);
}

function toMarkdownString(val) {
  if (Array.isArray(val)) return val.map(line => (line.trim().startsWith('-') ? line : `- ${line}`)).join('\n');
  return String(val || '');
}

function toFlashcards(arr, baseTs) {
  return (arr || []).map((fc, i) => ({ id: baseTs + i, front: fc.front, back: fc.back }));
}

function imageToBase64(file) {
  const buf = fs.readFileSync(file);
  const ext = path.extname(file).slice(1).toLowerCase() || 'png';
  return `data:image/${ext};base64,${buf.toString('base64')}`;
}

const raw = JSON.parse(fs.readFileSync(contentPath, 'utf8'));
if (!Array.isArray(raw.topics) || raw.topics.length === 0) {
  console.error('content.json must have a non-empty "topics" array. See the header comment in this file.');
  process.exit(1);
}
// raw.module (a string) forces every topic into one module. If it's null/absent, each topic's
// own "module" field decides — that's how a mixed batch becomes several modules.
if (!raw.module && !raw.topics.some(t => t.module)) {
  console.error('content.json has no top-level "module" and no per-topic "module" fields — nothing to group by.');
  process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
console.log('Connected.');

const course = await Course.findOne({ title: new RegExp(`^${courseTitle}$`, 'i') });
if (!course) {
  const all = await Course.find({}, 'title').lean();
  console.error(`No course titled "${courseTitle}" found. Existing courses: ${all.map(c => c.title).join(', ') || '(none)'}`);
  console.error('Create the course first via the app UI, then re-run.');
  process.exit(1);
}

const now = Date.now();
const moduleMap = new Map(); // preserves first-seen order of modules and their topics

for (let i = 0; i < raw.topics.length; i++) {
  const t = raw.topics[i];
  if (!t.title) { console.warn(`Skipping topic ${i}: missing title`); continue; }

  const modTitle = raw.module || (t.module || '').trim() || 'Untitled Module';
  const topicId = `topic-${now + i}`;

  const images = (t.images || []).map(name => imageToBase64(path.join(imagesDir, name)));

  await TopicData.findOneAndUpdate(
    { topicId },
    {
      topicId,
      images,
      notes: toMarkdownString(t.notes),
      keyConcepts: toMarkdownString(t.keyConcepts),
      codeNotes: toMarkdownString(t.codeNotes),
      flashcards: toFlashcards(t.flashcards, now + i * 100),
    },
    { upsert: true }
  );
  console.log(`  [${modTitle}] "${t.title}" (${topicId}) <- ${images.length} images, ${(t.flashcards || []).length} flashcards`);

  if (!moduleMap.has(modTitle)) moduleMap.set(modTitle, []);
  moduleMap.get(modTitle).push({ id: topicId, title: t.title, difficulty: t.difficulty || 'easy' });
}

const newModules = [...moduleMap.entries()].map(([title, topics], idx) => ({
  id: `module-${now + idx}`,
  title,
  topics,
}));

await Course.findOneAndUpdate({ id: course.id }, { $push: { modules: { $each: newModules } } });

const totalTopics = newModules.reduce((n, m) => n + m.topics.length, 0);
console.log(`\nInserted ${newModules.length} module(s) / ${totalTopics} topics into course "${course.title}":`);
newModules.forEach(m => console.log(`  - ${m.title} (${m.topics.length} topics)`));
await mongoose.disconnect();
