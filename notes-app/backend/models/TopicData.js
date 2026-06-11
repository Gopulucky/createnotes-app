import mongoose from 'mongoose';

const topicDataSchema = new mongoose.Schema({
  topicId: { type: String, required: true, unique: true },
  progress: { type: String, default: 'not-started' },
  notes: { type: String, default: '' },
  codeNotes: { type: String, default: '' },
  images: { type: [String], default: [] },
  keyConcepts: { type: String, default: '' },
  flashcards: { type: mongoose.Schema.Types.Mixed, default: [] },
  expectedOutput: { type: String, default: '' },
  codeMeta: { type: mongoose.Schema.Types.Mixed, default: {} }
});

export default mongoose.model('TopicData', topicDataSchema);
