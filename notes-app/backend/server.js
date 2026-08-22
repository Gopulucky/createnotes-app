import express from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import mongoose from 'mongoose';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import dotenv from 'dotenv';
import Course from './models/Course.js';
import TopicData from './models/TopicData.js';
import User from './models/User.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXPORT_DIR = path.join(__dirname, 'exported_code');

// Initialize Firebase Admin without credentials (only works for token verification)
initializeApp({
  projectId: "createnotes-8fb7c"
});

if (!fs.existsSync(EXPORT_DIR)) {
  fs.mkdirSync(EXPORT_DIR);
}

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/notes-app';

mongoose.connect(mongoURI)
  .then(() => console.log('MongoDB Connected to:', mongoURI.includes('127.0.0.1') ? 'Local Database' : 'Cloud Database'))
  .catch(err => console.error('MongoDB connection error:', err));

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Simple root route so the browser doesn't show "Cannot GET /"
app.get('/', (req, res) => {
  res.send('✅ CreateNotes Backend is successfully running!');
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'gopuhardik@gmail.com';

// One-time lazy migration: content created before multi-tenancy has no ownerId. The first
// time the admin authenticates, claim those orphans for them. Idempotent, and only runs
// when orphans actually exist, so it costs one cheap existence check per process.
let backfillChecked = false;
async function backfillLegacyOwnership(adminUid) {
  if (backfillChecked) return;
  backfillChecked = true;
  try {
    const orphan = await Course.exists({ ownerId: { $exists: false } });
    if (!orphan) return;
    const c = await Course.updateMany({ ownerId: { $exists: false } }, { $set: { ownerId: adminUid } });
    const t = await TopicData.updateMany({ ownerId: { $exists: false } }, { $set: { ownerId: adminUid } });
    console.log(`Backfilled ownership -> admin: ${c.modifiedCount} courses, ${t.modifiedCount} topic docs`);
  } catch (err) {
    backfillChecked = false; // allow a retry on the next admin request
    console.error('Ownership backfill failed:', err.message);
  }
}

// Authentication Middleware — any valid Google account may sign in. Authorisation is
// per-resource (ownerId), not per-email; the admin email only unlocks admin-only routes.
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const isAdmin = decodedToken.email === ADMIN_EMAIL;

    req.user = decodedToken;
    req.uid = decodedToken.uid;
    req.isAdmin = isAdmin;

    // Keep a lightweight user record so the admin has something to administrate.
    User.findOneAndUpdate(
      { uid: decodedToken.uid },
      {
        $set: {
          email: decodedToken.email || '',
          displayName: decodedToken.name || '',
          photoURL: decodedToken.picture || '',
          role: isAdmin ? 'admin' : 'user',
          lastSeenAt: new Date(),
        },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    ).catch(err => console.error('User upsert failed:', err.message));

    // Awaited so the admin's very first request after this deploy can't race ahead of the
    // migration and briefly render as "0 courses" before a refresh fixes it.
    if (isAdmin) await backfillLegacyOwnership(decodedToken.uid);

    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: `Token verification failed: ${error.message}` });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.isAdmin) return res.status(403).json({ error: 'Forbidden: admin only' });
  next();
};

// Course is the authority on who owns a topic; TopicData.ownerId is only a denormalised copy.
const userOwnsTopic = (uid, topicId) => Course.exists({ ownerId: uid, 'modules.topics.id': topicId });

// Apply auth middleware to all /api routes
app.use('/api', authenticateUser);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Lightweight: course/module/topic structure + a per-topic completion map only.
// Deliberately excludes notes/codeNotes/images/keyConcepts/flashcards/expectedOutput/codeMeta —
// those are fetched per-topic on demand (see getTopicContent) so the app doesn't have to
// download every topic's base64 images just to render the sidebar.
const getCourseStructure = async (ownerId) => {
  try {
    const courses = await Course.find({ ownerId }).lean();
    courses.forEach(c => { delete c._id; delete c.__v; delete c.ownerId; });

    // Scope progress to this user's own topics only.
    const topicIds = courses.flatMap(c => (c.modules || []).flatMap(m => (m.topics || []).map(t => t.id)));

    // Which of the three Learn steps each topic has content for. Computed with an
    // aggregation rather than a find(), so the base64 image arrays are reduced to a
    // count inside Mongo and never travel to the app server at all — that's the whole
    // reason this function avoids the content fields in the first place.
    const fillList = await TopicData.aggregate([
      { $match: { topicId: { $in: topicIds } } },
      {
        $project: {
          _id: 0,
          topicId: 1,
          // $trim before measuring length: a whitespace-only save must not count as
          // filled here while Article.jsx's own .trim() check (its local, un-saved
          // source of truth) disagrees.
          keyConcepts: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$keyConcepts', ''] } } } }, 0] },
          images: { $gt: [{ $size: { $ifNull: ['$images', []] } }, 0] },
          notes: { $gt: [{ $strLenCP: { $trim: { input: { $ifNull: ['$notes', ''] } } } }, 0] },
        },
      },
    ]);

    const completion = {};
    for (const f of fillList) {
      completion[f.topicId] = { keyConcepts: f.keyConcepts, images: f.images, notes: f.notes };
    }

    return { courses, completion };
  } catch (err) {
    console.error('Error fetching course structure:', err);
    throw err;
  }
};

const getTopicContent = async (topicId) => {
  const td = await TopicData.findOne({ topicId }).lean();
  return {
    progress: td?.progress || 'not-started',
    notes: td?.notes || '',
    codeNotes: td?.codeNotes || '',
    images: td?.images || [],
    keyConcepts: td?.keyConcepts || '',
    flashcards: td?.flashcards || [],
    expectedOutput: td?.expectedOutput || '',
    codeMeta: td?.codeMeta || {},
  };
};

app.get('/api/data', async (req, res) => {
  try {
    const db = await getCourseStructure(req.uid);
    res.json({ ...db, isAdmin: req.isAdmin });
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- COURSES --- */
app.post('/api/courses', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    await Course.create({
      id: `course-${Date.now()}`,
      ownerId: req.uid,
      title,
      description: description || '',
      coverImage: null,
      modules: []
    });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/courses/:id', async (req, res) => {
  const { title, description } = req.body;
  try {
    const update = {};
    if (title) update.title = title;
    if (description) update.description = description;
    const done = await Course.findOneAndUpdate({ id: req.params.id, ownerId: req.uid }, update);
    if (!done) return res.status(404).json({ error: 'Course not found' });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    const course = await Course.findOneAndDelete({ id: req.params.id, ownerId: req.uid });
    if (!course) return res.status(404).json({ error: 'Course not found' });
    // Don't leave the course's topic content orphaned in the database.
    const topicIds = (course.modules || []).flatMap(m => (m.topics || []).map(t => t.id));
    if (topicIds.length) await TopicData.deleteMany({ topicId: { $in: topicIds } });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- MODULES --- */
app.post('/api/modules', async (req, res) => {
  const { courseId, title } = req.body;
  if (!title || !courseId) return res.status(400).json({ error: 'Title and courseId required' });
  try {
    const done = await Course.findOneAndUpdate(
      { id: courseId, ownerId: req.uid },
      { $push: { modules: { id: `module-${Date.now()}`, title, topics: [] } } }
    );
    if (!done) return res.status(404).json({ error: 'Course not found' });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/modules/:id', async (req, res) => {
  const { title } = req.body;
  try {
    const done = await Course.findOneAndUpdate(
      { "modules.id": req.params.id, ownerId: req.uid },
      { $set: { "modules.$.title": title } }
    );
    if (!done) return res.status(404).json({ error: 'Module not found' });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/modules/:id', async (req, res) => {
  try {
    const course = await Course.findOne({ "modules.id": req.params.id, ownerId: req.uid });
    if (!course) return res.status(404).json({ error: 'Module not found' });
    const mod = course.modules.find(m => m.id === req.params.id);
    const topicIds = (mod?.topics || []).map(t => t.id);

    await Course.findOneAndUpdate(
      { "modules.id": req.params.id, ownerId: req.uid },
      { $pull: { modules: { id: req.params.id } } }
    );
    if (topicIds.length) await TopicData.deleteMany({ topicId: { $in: topicIds } });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- TOPICS --- */
app.post('/api/topics', async (req, res) => {
  const { moduleId, title, difficulty } = req.body;
  try {
    const done = await Course.findOneAndUpdate(
      { "modules.id": moduleId, ownerId: req.uid },
      { $push: { "modules.$.topics": { id: `topic-${Date.now()}`, title, difficulty: difficulty || 'easy' } } }
    );
    if (!done) return res.status(404).json({ error: 'Module not found' });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/topics/:id', async (req, res) => {
  const { title, difficulty } = req.body;
  try {
    const course = await Course.findOne({ "modules.topics.id": req.params.id, ownerId: req.uid });
    if (!course) return res.status(404).json({ error: 'Topic not found' });
    course.modules.forEach(m => {
      const t = m.topics.find(top => top.id === req.params.id);
      if (t) {
        if (title) t.title = title;
        if (difficulty) t.difficulty = difficulty;
      }
    });
    await course.save();
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/topics/:id', async (req, res) => {
  try {
    const course = await Course.findOne({ "modules.topics.id": req.params.id, ownerId: req.uid });
    if (!course) return res.status(404).json({ error: 'Topic not found' });
    course.modules.forEach(m => {
      m.topics = m.topics.filter(t => t.id !== req.params.id);
    });
    await course.save();
    await TopicData.deleteOne({ topicId: req.params.id });
    res.json(await getCourseStructure(req.uid));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- CONTENT --- */
// Returns just the updated topic's content (not the whole DB / every topic's images).
const updateTopicData = async (req, res, field, val) => {
  try {
    if (!await userOwnsTopic(req.uid, req.body.topicId)) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    await TopicData.findOneAndUpdate(
      { topicId: req.body.topicId },
      { [field]: val, ownerId: req.uid },
      { upsert: true, new: true }
    );
    res.json(await getTopicContent(req.body.topicId));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
};

// Progress also lives in the lightweight course structure (drives sidebar/dashboard
// progress bars), so it returns that instead of single-topic content.
// NOTE: /api/progress was removed — a topic's progress is now derived from which of
// the three Learn sections have content (see getCourseStructure), rather than from a
// status the user sets by hand. The TopicData.progress field is left in place so old
// documents keep validating, but nothing reads or writes it.
app.post('/api/notes', (req, res) => updateTopicData(req, res, 'notes', req.body.content));
app.post('/api/codeNotes', (req, res) => updateTopicData(req, res, 'codeNotes', req.body.content));
app.post('/api/keyConcepts', (req, res) => updateTopicData(req, res, 'keyConcepts', req.body.content));
app.post('/api/flashcards', (req, res) => updateTopicData(req, res, 'flashcards', req.body.flashcards));
app.post('/api/expectedOutput', (req, res) => updateTopicData(req, res, 'expectedOutput', req.body.content));
app.post('/api/codeMeta', (req, res) => updateTopicData(req, res, 'codeMeta', req.body.meta));

app.get('/api/topics/:topicId/content', async (req, res) => {
  try {
    if (!await userOwnsTopic(req.uid, req.params.topicId)) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    res.json(await getTopicContent(req.params.topicId));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.post('/api/upload', upload.single('image'), async (req, res) => {
  const topicId = req.body.topicId;
  if (!req.file || !topicId) return res.status(400).json({ error: 'Image and topicId required' });
  try {
    if (!await userOwnsTopic(req.uid, topicId)) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await TopicData.findOneAndUpdate(
      { topicId: topicId },
      { $push: { images: base64Image }, $set: { ownerId: req.uid } },
      { upsert: true }
    );
    res.json(await getTopicContent(topicId));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/images', async (req, res) => {
  const { topicId, imageUrl } = req.body;
  if (!topicId || !imageUrl) return res.status(400).json({ error: 'Missing topicId or imageUrl' });
  try {
    if (!await userOwnsTopic(req.uid, topicId)) {
      return res.status(404).json({ error: 'Topic not found' });
    }
    // Remove from DB
    await TopicData.findOneAndUpdate(
      { topicId: topicId },
      { $pull: { images: imageUrl } }
    );
    
    // Remove physical file if it is an old file stored locally
    if (!imageUrl.startsWith('data:')) {
      const filename = path.basename(imageUrl);
      const filePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    
    res.json(await getTopicContent(topicId));
  } catch (err) {
    console.error('Error deleting image:', err);
    res.status(500).json({ error: 'Server Error' });
  }
});

/* --- AI IMPORT (screenshots -> module/topics via a user-supplied Gemini key) ---
   The API key arrives in the request body, is held only in a local variable for the
   life of this one request, and is never written to disk, .env, or the database. */
const importUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 300 } });

const IMPORT_RESPONSE_SCHEMA = {
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

// The notes these produce are for revisiting cold months later, so the prompt asks for
// recall-oriented structure (why/when, gotchas, worked example) rather than slide summaries.
function buildImportPrompt(batchFilenames, { fixedModule, knownModules } = {}) {
  const manifest = batchFilenames.map((f, i) => `Image ${i + 1} = "${f}"`).join('\n');

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

// Model names get retired (a hardcoded one already 404'd with "no longer available to new
// users"), so ask the key which models it can actually use and score them, instead of
// betting on a name staying valid.
// Returns an ordered list of up to 3 candidate model IDs, best first.
// If the top-ranked model is overloaded the caller can fall back to the next.
async function resolveGeminiModels(apiKey, requested) {
  if (requested && requested !== 'auto') return [requested];

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}&pageSize=200`);
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Could not list Gemini models (${res.status}): ${errText.slice(0, 200)}`);
  }
  const { models = [] } = await res.json();

  const EXCLUDE = /embedding|aqa|tts|imagen|veo|image-generation|native-audio|live-|robotics/i;
  const candidates = models
    .filter(m => (m.supportedGenerationMethods || []).includes('generateContent'))
    .filter(m => !EXCLUDE.test(m.name || ''));

  if (candidates.length === 0) throw new Error('No Gemini models available to this API key support generateContent.');

  const score = (m) => {
    const id = (m.name || '').replace(/^models\//, '');
    let s = 0;
    if (/flash/i.test(id)) s += 100;        // fast + generous free tier, good for vision batches
    else if (/pro/i.test(id)) s += 60;
    if (/-latest$/i.test(id)) s += 40;      // alias that keeps working as versions roll
    const ver = parseFloat((id.match(/gemini-(\d+(?:\.\d+)?)/i) || [])[1] || '0');
    s += ver * 10;
    if (/lite/i.test(id)) s -= 25;          // cheaper but weaker at long structured output
    if (/preview|exp/i.test(id)) s -= 8;    // prefer stable when equally ranked
    return s;
  };

  const ranked = candidates.sort((a, b) => score(b) - score(a));
  return ranked.slice(0, 3).map(m => (m.name || '').replace(/^models\//, ''));
}

async function callGeminiForImport(apiKey, modelCandidates, batchFiles, promptOpts) {
  const parts = [{ text: buildImportPrompt(batchFiles.map(f => f.basename), promptOpts) }];
  for (const f of batchFiles) {
    parts.push({ inlineData: { mimeType: f.mimetype, data: f.buffer.toString('base64') } });
  }

  const payloadSizeMB = (Buffer.byteLength(JSON.stringify(parts)) / (1024 * 1024)).toFixed(1);

  let lastStatus = 0;
  let lastErrBody = '';
  let lastModel = modelCandidates[0];

  // Try each model candidate; for each model, retry up to 2 times on transient errors.
  for (const model of modelCandidates) {
    lastModel = model;
    console.log(`Trying model: ${model} (payload ${payloadSizeMB} MB, ${batchFiles.length} images)`);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const body = {
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: IMPORT_RESPONSE_SCHEMA },
    };

    for (let attempt = 1; attempt <= 2; attempt++) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

      if (res.status === 429 || res.status >= 500) {
        lastStatus = res.status;
        lastErrBody = await res.text();
        const isOverloaded = lastErrBody.includes('high demand') || lastErrBody.includes('overloaded') || res.status === 503;
        console.error(`${model} attempt ${attempt}/2 failed (${res.status}). ${isOverloaded ? 'Model overloaded, will try fallback.' : 'Retrying...'}`);

        if (isOverloaded) break; // skip to next model immediately, don't retry the same overloaded one
        await new Promise(r => setTimeout(r, attempt * 6000));
        continue;
      }
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) throw new Error('Unexpected Gemini response shape');
      return { result: JSON.parse(text), model };
    }
  }

  // All models exhausted
  let detail = `HTTP ${lastStatus}`;
  try {
    const parsed = JSON.parse(lastErrBody);
    detail = parsed?.error?.message || parsed?.error?.status || detail;
  } catch { detail += `: ${lastErrBody.slice(0, 200)}`; }

  throw new Error(`All ${modelCandidates.length} models failed (${detail}). Tried: ${modelCandidates.join(', ')}. Payload was ${payloadSizeMB} MB for ${batchFiles.length} images.`);
}

app.post('/api/import/generate', importUpload.array('images', 300), async (req, res) => {
  const apiKey = req.body.apiKey; // request-scoped only — never persisted
  const moduleName = (req.body.moduleName || '').trim(); // blank => let the AI detect modules
  const courseId = req.body.courseId;
  const requestedModel = req.body.model || 'auto';
  const files = req.files || [];

  if (!apiKey || !courseId || files.length === 0) {
    return res.status(400).json({ error: 'apiKey, courseId, and at least one image are required' });
  }

  res.setHeader('Content-Type', 'application/x-ndjson');
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    const course = await Course.findOne({ id: courseId, ownerId: req.uid });
    if (!course) {
      send({ type: 'error', message: `Course ${courseId} not found` });
      return res.end();
    }

    const namedFiles = files.map(f => ({ ...f, basename: path.basename(f.originalname) }));
    const fileByName = new Map(namedFiles.map(f => [f.basename, f]));

    const BATCH_SIZE = 25;
    const allTopics = [];
    const knownModules = []; // fed back into later batches so the same concept keeps one name
    const totalBatches = Math.ceil(namedFiles.length / BATCH_SIZE);
    send({ type: 'start', totalImages: namedFiles.length, totalBatches });

    const modelCandidates = await resolveGeminiModels(apiKey, requestedModel);
    send({ type: 'progress', message: `Model candidates: ${modelCandidates.join(', ')}` });

    for (let i = 0; i < namedFiles.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = namedFiles.slice(i, i + BATCH_SIZE);
      send({ type: 'progress', message: `Batch ${batchNum}/${totalBatches}: analyzing ${batch.length} images...` });

      const { result, model: usedModel } = await callGeminiForImport(apiKey, modelCandidates, batch, {
        fixedModule: moduleName || null,
        knownModules,
      });
      const batchTopics = result.topics || [];
      allTopics.push(...batchTopics);

      for (const t of batchTopics) {
        const m = (t.module || '').trim();
        if (m && !knownModules.includes(m)) knownModules.push(m);
      }

      const foundModules = [...new Set(batchTopics.map(t => (t.module || '').trim()).filter(Boolean))];
      send({
        type: 'progress',
        message: `Batch ${batchNum}/${totalBatches}: ${batchTopics.length} topics` +
          (moduleName ? '' : ` across ${foundModules.length} module(s): ${foundModules.join(', ')}`),
      });

      if (i + BATCH_SIZE < namedFiles.length) await new Promise(r => setTimeout(r, 3000));
    }

    send({ type: 'progress', message: `Saving ${allTopics.length} topics to the database...` });

    const now = Date.now();
    const toMd = (val) => Array.isArray(val) ? val.map(l => (l.trim().startsWith('-') ? l : `- ${l}`)).join('\n') : String(val || '');

    // Group topics into modules, preserving first-seen order for both modules and their topics.
    const moduleMap = new Map();
    for (let i = 0; i < allTopics.length; i++) {
      const t = allTopics[i];
      if (!t.title) continue;

      const modTitle = moduleName || (t.module || '').trim() || 'Untitled Module';
      const topicId = `topic-${now + i}`;

      const images = (t.images || [])
        .map(name => fileByName.get(path.basename(name)))
        .filter(Boolean)
        .map(f => `data:${f.mimetype};base64,${f.buffer.toString('base64')}`);

      const flashcards = (t.flashcards || []).map((fc, j) => ({ id: now + i * 100 + j, front: fc.front, back: fc.back }));

      await TopicData.findOneAndUpdate(
        { topicId },
        { topicId, ownerId: req.uid, images, notes: toMd(t.notes), keyConcepts: toMd(t.keyConcepts), codeNotes: toMd(t.codeNotes), flashcards },
        { upsert: true }
      );

      if (!moduleMap.has(modTitle)) moduleMap.set(modTitle, []);
      moduleMap.get(modTitle).push({ id: topicId, title: t.title, difficulty: 'easy' });
    }

    const newModules = [...moduleMap.entries()].map(([title, topics], idx) => ({
      id: `module-${now + idx}`,
      title,
      topics,
    }));

    await Course.findOneAndUpdate({ id: courseId, ownerId: req.uid }, { $push: { modules: { $each: newModules } } });

    const topicCount = newModules.reduce((n, m) => n + m.topics.length, 0);
    send({
      type: 'done',
      topicCount,
      moduleCount: newModules.length,
      modules: newModules.map(m => ({ title: m.title, topicCount: m.topics.length })),
    });
    res.end();
  } catch (err) {
    console.error('Import failed:', err.message);
    send({ type: 'error', message: err.message });
    res.end();
  }
});

// Writes to the shared server's local filesystem and shells out to git — not something that
// makes sense per-user on shared hosting, so it stays admin-only rather than trying to isolate
// per-tenant export directories.
app.post('/api/export', requireAdmin, (req, res) => {
  const { topicId, topicTitle, content } = req.body;
  if (!topicTitle || !content) return res.status(400).json({ error: 'Missing title or content' });
  const folderName = topicTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const targetDir = path.join(EXPORT_DIR, folderName);
  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir);
    fs.writeFileSync(path.join(targetDir, 'index.js'), content, 'utf8');
    exec(`git init && git add . && git -c user.name="NotesApp" -c user.email="export@notes.local" commit -m "Auto-export: ${topicTitle}"`, { cwd: targetDir }, (error, stdout) => {
      if (error && !stdout.includes('nothing to commit')) return res.status(500).json({ error: 'Failed to commit' });
      res.json({ success: true, path: targetDir });
    });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

/* --- ADMIN --- */
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  try {
    const users = await User.find({}).sort({ lastSeenAt: -1 }).lean();
    const courseCounts = await Course.aggregate([{ $group: { _id: '$ownerId', count: { $sum: 1 } } }]);
    const countByOwner = Object.fromEntries(courseCounts.map(c => [c._id, c.count]));
    res.json(users.map(u => ({
      uid: u.uid,
      email: u.email,
      displayName: u.displayName,
      photoURL: u.photoURL,
      role: u.role,
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      courseCount: countByOwner[u.uid] || 0,
    })));
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

// Deletes a user's account record and every course/topic they own. Does not (and cannot)
// delete their Firebase auth account — that requires the Firebase Admin SDK service account
// credentials this deployment doesn't have configured; they'd just be signed out and, since
// User.findOneAndUpdate on next login re-upserts them, effectively reset to a fresh account.
app.delete('/api/admin/users/:uid', requireAdmin, async (req, res) => {
  if (req.params.uid === req.uid) return res.status(400).json({ error: "Can't delete your own admin account" });
  try {
    const courses = await Course.find({ ownerId: req.params.uid }).lean();
    const topicIds = courses.flatMap(c => (c.modules || []).flatMap(m => (m.topics || []).map(t => t.id)));
    if (topicIds.length) await TopicData.deleteMany({ topicId: { $in: topicIds } });
    await Course.deleteMany({ ownerId: req.params.uid });
    await User.deleteOne({ uid: req.params.uid });
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
