// Free automation, no Claude required: reads a folder of screenshots, sends them to Google's
// Gemini API (free tier via a Google AI Studio key) in batches, and asks it to group the images
// into topics and write notes/keyConcepts/codeNotes/flashcards for each — the same job Claude's
// subagents did earlier in this project. Writes a content.json compatible with import-topics.mjs.
//
// Setup (one time):
//   1. Get a free API key: https://aistudio.google.com/apikey (use AI Studio, not Cloud Console —
//      AI Studio keys are free with no billing required, just daily/per-minute rate limits).
//   2. Add it to notes-app/backend/.env:  GEMINI_API_KEY=your-key-here
//
// Usage:
//   node generate-content.mjs "<screenshots folder>" "<Module Title>" [output.json]
//
// Then review the output file and run:
//   node import-topics.mjs output.json --images-dir "<screenshots folder>" --course "<course title>"

import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

// 'auto' asks the API which models this key can use and picks the best (model names get
// retired, so hardcoding one eventually 404s). Override with GEMINI_MODEL in .env if needed.
const MODEL = process.env.GEMINI_MODEL || 'auto';
const BATCH_SIZE = 25; // images per API call — keeps requests small and free-tier-friendly
const BATCH_DELAY_MS = 4000; // gentle pacing between calls to stay under per-minute rate limits

const [, , folderArg, moduleArg, outputArg] = process.argv;
if (!folderArg || !moduleArg) {
  console.error('Usage: node generate-content.mjs "<screenshots folder>" "<Module Title>|auto" [output.json]');
  console.error('  Pass "auto" as the module title to let the AI split topics into modules by concept.');
  process.exit(1);
}

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error('Missing GEMINI_API_KEY. Add it to notes-app/backend/.env — get a free key at https://aistudio.google.com/apikey');
  process.exit(1);
}

const folder = path.resolve(folderArg);
const outputPath = path.resolve(outputArg || 'content.json');
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.webp']);

const files = fs.readdirSync(folder)
  .filter(f => IMAGE_EXT.has(path.extname(f).toLowerCase()))
  .sort(); // chronological if filenames are timestamped, like "Screenshot 2026-06-05 114235.png"

if (files.length === 0) {
  console.error(`No images found in ${folder}`);
  process.exit(1);
}

console.log(`Found ${files.length} images. Processing in batches of ${BATCH_SIZE}...`);

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    topics: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          module: { type: 'STRING' },
          title: { type: 'STRING' },
          images: { type: 'ARRAY', items: { type: 'STRING' } },
          notes: { type: 'STRING' },
          keyConcepts: { type: 'STRING' },
          codeNotes: { type: 'STRING' },
          flashcards: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: { front: { type: 'STRING' }, back: { type: 'STRING' } },
              required: ['front', 'back'],
            },
          },
        },
        required: ['module', 'title', 'images', 'notes', 'keyConcepts', 'codeNotes', 'flashcards'],
      },
    },
  },
  required: ['topics'],
};

function mimeFor(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.webp') return 'image/webp';
  return 'image/png';
}

// Keep this prompt in sync with buildImportPrompt() in ../server.js — the in-app Import panel
// and this script are meant to produce identical quality.
function buildPrompt(batchFiles, { fixedModule, knownModules } = {}) {
  const manifest = batchFiles.map((f, i) => `Image ${i + 1} = "${f}"`).join('\n');

  const moduleInstruction = fixedModule
    ? `Set "module" to exactly "${fixedModule}" for every topic.`
    : `Set "module" to the broader concept/chapter this topic belongs to — the unit a textbook or syllabus would use (e.g. "Sorting", "Linked Lists", "Backtracking", "Dynamic Programming", "Flexbox", "React Hooks"). Several topics normally share one module: e.g. topics "Bubble Sort", "Merge Sort" and "Quick Sort" all belong to module "Sorting". Keep module names short (1-3 words) and reuse the SAME spelling for the same concept every time.${
        knownModules?.length
          ? `\nModules already identified in earlier batches — reuse these names verbatim when a topic belongs to one of them, and only invent a new name for a genuinely new concept:\n${knownModules.map(m => `- ${m}`).join('\n')}`
          : ''
      }`;

  return `These are lecture-slide screenshots from a course video, in chronological order. File manifest:
${manifest}

Split the images into topics using each slide's visible heading. Slides with no heading (editor screenshots, terminal output, browser windows) belong to whichever topic the surrounding slides belong to — this is one continuous lecture, so use the flow to decide.

${moduleInstruction}

You are writing revision notes for someone who understood this once and will return to it months later having forgotten the details. They should be able to rebuild their understanding from your notes WITHOUT rewatching the video or squinting at the screenshots. Never write "as shown in the slide" or "the instructor explains" — the notes must stand alone.

For each topic produce:

- "images": exact filenames from the manifest above belonging to this topic, in order.

- "notes": 250-450 words of markdown. Structure it as:
  a short plain-language definition of what this is and **why it exists / what problem it solves**;
  then how it actually works, in your own words, building from simple to complete;
  then when to use it versus the alternatives;
  then the gotchas — the mistakes people actually make, edge cases, and anything counter-intuitive.
  Use **bold** for terms worth remembering, \`code spans\` for syntax/keywords, and short lists.
  Explain the *reasoning*, not just the mechanics — the "why it behaves this way" is what makes it
  come back quickly on reread. Where the slides show a concrete walkthrough (a trace, an example
  input/output, a diagram), reconstruct it in words so the idea survives without the picture.
  If it's an algorithm/data structure, always state its time and space complexity and why.

- "keyConcepts": 5-9 markdown bullets ("- " list). Each must be a complete, self-contained fact
  that carries real information — a rule, a tradeoff, a complexity, a syntax pattern, a gotcha.
  These are the skim-in-30-seconds layer before an exam or interview. Write "Merge sort is stable
  and always O(n log n), but needs O(n) extra space" — not "Merge sort has good complexity".

- "codeNotes": ONE clean, correct, runnable code example that demonstrates the topic end to end,
  synthesized from what the slides show. Include brief inline comments on the non-obvious lines
  (the ones a beginner would misread). Empty string if the topic genuinely involves no code.

- "flashcards": 5-7 {front, back} pairs for active recall. Mix the types: definitions ("What is X?"),
  application ("Which sort would you use when memory is tight and why?"), tracing ("What does this
  code output?"), and comparison ("Difference between X and Y?"). The "front" must be answerable
  from memory and unambiguous; the "back" must be a complete answer with the reason, not one word.
  Prefer questions that test understanding over questions that test vocabulary.

Return topics in the order they first appear.`;
}

async function resolveModel(requested) {
  if (requested && requested !== 'auto') return requested;

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}&pageSize=200`);
  if (!res.ok) throw new Error(`Could not list Gemini models (${res.status}): ${(await res.text()).slice(0, 200)}`);
  const { models = [] } = await res.json();

  const EXCLUDE = /embedding|aqa|tts|imagen|veo|image-generation|native-audio|live-|robotics/i;
  const candidates = models
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .filter(m => !EXCLUDE.test(m.name || ''));
  if (candidates.length === 0) throw new Error('No models available to this API key support generateContent.');

  const score = (m) => {
    const id = (m.name || '').replace(/^models\//, '');
    let s = 0;
    if (/flash/i.test(id)) s += 100;
    else if (/pro/i.test(id)) s += 60;
    if (/-latest$/i.test(id)) s += 40;
    s += parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0') * 10;
    if (/lite/i.test(id)) s -= 25;
    if (/preview|exp/i.test(id)) s -= 8;
    return s;
  };

  return (candidates.sort((a, b) => score(b) - score(a))[0].name || '').replace(/^models\//, '');
}

const resolvedModel = await resolveModel(MODEL);
console.log(`Using model: ${resolvedModel}`);

async function callGemini(batchFiles, promptOpts) {
  const parts = [{ text: buildPrompt(batchFiles, promptOpts) }];
  for (const f of batchFiles) {
    const data = fs.readFileSync(path.join(folder, f)).toString('base64');
    parts.push({ inlineData: { mimeType: mimeFor(f), data } });
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${resolvedModel}:generateContent?key=${API_KEY}`;
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA,
    },
  };

  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.status === 429 || res.status >= 500) {
      const wait = attempt * 8000;
      const errText = await res.text();
      console.warn(`  Gemini returned ${res.status} (${errText.slice(0, 300)}), retrying in ${wait / 1000}s (attempt ${attempt}/4)...`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 500)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error(`Unexpected Gemini response shape: ${JSON.stringify(data).slice(0, 500)}`);
    return JSON.parse(text);
  }

  throw new Error('Gemini API kept failing after 4 attempts — try again later or check your rate limits.');
}

const fixedModule = moduleArg === 'auto' ? null : moduleArg;
if (!fixedModule) console.log('Module name "auto" — letting the AI group topics into modules by concept.');

const allTopics = [];
const knownModules = []; // fed forward so the same concept keeps one name across batches
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  console.log(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} images...`);
  const result = await callGemini(batch, { fixedModule, knownModules });
  const batchTopics = result.topics || [];
  allTopics.push(...batchTopics);

  for (const t of batchTopics) {
    const m = (t.module || '').trim();
    if (m && !knownModules.includes(m)) knownModules.push(m);
  }
  console.log(`  -> ${batchTopics.length} topics found`);

  if (i + BATCH_SIZE < files.length) {
    await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
  }
}

const output = { module: fixedModule || null, topics: allTopics };
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

const moduleSummary = fixedModule
  ? `1 module ("${fixedModule}")`
  : `${knownModules.length} modules (${knownModules.join(', ')})`;
console.log(`\nWrote ${allTopics.length} topics across ${moduleSummary} to ${outputPath}`);
console.log(`Review it, then run:\n  node import-topics.mjs "${outputPath}" --images-dir "${folder}" --course "<your course title>"`);
