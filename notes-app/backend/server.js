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

// Authentication Middleware
const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    if (decodedToken.email !== 'gopuhardik@gmail.com') {
      return res.status(403).json({ error: 'Forbidden: Invalid email' });
    }
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: `Token verification failed: ${error.message}` });
  }
};

// Apply auth middleware to all /api routes
app.use('/api', authenticateUser);

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const getFullDbState = async () => {
  try {
    const courses = await Course.find({}).lean();
    courses.forEach(c => { delete c._id; delete c.__v; }); // clean up for frontend
    
    const topicDataList = await TopicData.find({}).lean();
    
    const db = {
      courses,
      progress: {},
      notes: {},
      codeNotes: {},
      images: {},
      keyConcepts: {},
      flashcards: {},
      expectedOutput: {},
      codeMeta: {}
    };

    for (const td of topicDataList) {
      const tId = td.topicId;
      if (td.progress) db.progress[tId] = td.progress;
      if (td.notes) db.notes[tId] = td.notes;
      if (td.codeNotes) db.codeNotes[tId] = td.codeNotes;
      if (td.images && td.images.length > 0) db.images[tId] = td.images;
      if (td.keyConcepts) db.keyConcepts[tId] = td.keyConcepts;
      if (td.flashcards && td.flashcards.length > 0) db.flashcards[tId] = td.flashcards;
      if (td.expectedOutput) db.expectedOutput[tId] = td.expectedOutput;
      if (td.codeMeta && Object.keys(td.codeMeta).length > 0) db.codeMeta[tId] = td.codeMeta;
    }

    return db;
  } catch (err) {
    console.error('Error fetching DB state:', err);
    throw err;
  }
};

app.get('/api/data', async (req, res) => {
  try {
    const db = await getFullDbState();
    res.json(db);
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- COURSES --- */
app.post('/api/courses', async (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });
  try {
    await Course.create({
      id: `course-${Date.now()}`,
      title,
      description: description || '',
      coverImage: null,
      modules: []
    });
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/courses/:id', async (req, res) => {
  const { title, description } = req.body;
  try {
    const update = {};
    if (title) update.title = title;
    if (description) update.description = description;
    await Course.findOneAndUpdate({ id: req.params.id }, update);
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/courses/:id', async (req, res) => {
  try {
    await Course.findOneAndDelete({ id: req.params.id });
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- MODULES --- */
app.post('/api/modules', async (req, res) => {
  const { courseId, title } = req.body;
  if (!title || !courseId) return res.status(400).json({ error: 'Title and courseId required' });
  try {
    await Course.findOneAndUpdate(
      { id: courseId },
      { $push: { modules: { id: `module-${Date.now()}`, title, topics: [] } } }
    );
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/modules/:id', async (req, res) => {
  const { title } = req.body;
  try {
    await Course.findOneAndUpdate(
      { "modules.id": req.params.id },
      { $set: { "modules.$.title": title } }
    );
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/modules/:id', async (req, res) => {
  try {
    await Course.findOneAndUpdate(
      { "modules.id": req.params.id },
      { $pull: { modules: { id: req.params.id } } }
    );
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- TOPICS --- */
app.post('/api/topics', async (req, res) => {
  const { moduleId, title, difficulty } = req.body;
  try {
    await Course.findOneAndUpdate(
      { "modules.id": moduleId },
      { $push: { "modules.$.topics": { id: `topic-${Date.now()}`, title, difficulty: difficulty || 'easy' } } }
    );
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.put('/api/topics/:id', async (req, res) => {
  const { title, difficulty } = req.body;
  try {
    const course = await Course.findOne({ "modules.topics.id": req.params.id });
    if (course) {
      course.modules.forEach(m => {
        const t = m.topics.find(top => top.id === req.params.id);
        if (t) {
          if (title) t.title = title;
          if (difficulty) t.difficulty = difficulty;
        }
      });
      await course.save();
    }
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/topics/:id', async (req, res) => {
  try {
    const course = await Course.findOne({ "modules.topics.id": req.params.id });
    if (course) {
      course.modules.forEach(m => {
        m.topics = m.topics.filter(t => t.id !== req.params.id);
      });
      await course.save();
    }
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

/* --- CONTENT --- */
const updateTopicData = async (req, res, field, val) => {
  try {
    await TopicData.findOneAndUpdate(
      { topicId: req.body.topicId },
      { [field]: val },
      { upsert: true, new: true }
    );
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
};

app.post('/api/progress', (req, res) => updateTopicData(req, res, 'progress', req.body.status));
app.post('/api/notes', (req, res) => updateTopicData(req, res, 'notes', req.body.content));
app.post('/api/codeNotes', (req, res) => updateTopicData(req, res, 'codeNotes', req.body.content));
app.post('/api/keyConcepts', (req, res) => updateTopicData(req, res, 'keyConcepts', req.body.content));
app.post('/api/flashcards', (req, res) => updateTopicData(req, res, 'flashcards', req.body.flashcards));
app.post('/api/expectedOutput', (req, res) => updateTopicData(req, res, 'expectedOutput', req.body.content));
app.post('/api/codeMeta', (req, res) => updateTopicData(req, res, 'codeMeta', req.body.meta));

app.post('/api/upload', upload.single('image'), async (req, res) => {
  const topicId = req.body.topicId;
  if (!req.file || !topicId) return res.status(400).json({ error: 'Image and topicId required' });
  try {
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    await TopicData.findOneAndUpdate(
      { topicId: topicId },
      { $push: { images: base64Image } },
      { upsert: true }
    );
    res.json(await getFullDbState());
  } catch (err) { res.status(500).json({ error: 'Server Error' }); }
});

app.delete('/api/images', async (req, res) => {
  const { topicId, imageUrl } = req.body;
  if (!topicId || !imageUrl) return res.status(400).json({ error: 'Missing topicId or imageUrl' });
  try {
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
    
    res.json(await getFullDbState());
  } catch (err) { 
    console.error('Error deleting image:', err);
    res.status(500).json({ error: 'Server Error' }); 
  }
});

app.post('/api/export', (req, res) => {
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
