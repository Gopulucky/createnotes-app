import mongoose from 'mongoose';

const topicDataSchema = new mongoose.Schema({
  topicId: { type: String, required: true, unique: true },
  // Denormalised from the owning Course for fast per-user queries (e.g. the progress map).
  // Course.ownerId remains the authority for write-permission checks.
  ownerId: { type: String, index: true },
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
