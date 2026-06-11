import mongoose from 'mongoose';

const topicSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  difficulty: { type: String, default: 'easy' }
}, { _id: false });

const moduleSchema = new mongoose.Schema({
  id: { type: String, required: true },
  title: { type: String, required: true },
  topics: [topicSchema]
}, { _id: false });

const courseSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' },
  coverImage: { type: String, default: null },
  modules: [moduleSchema]
});

export default mongoose.model('Course', courseSchema);
