import mongoose from 'mongoose';

const BotKnowledgeSchema = new mongoose.Schema({
  sourceType: {
    type: String,
    enum: ['manual', 'pdf', 'web', 'image'],
    default: 'manual'
  },
  sourceUrl: {
    type: String
  },
  title: {
    type: String
  },
  content: {
    type: String,
    required: true
  },
  tags: [String],
  // Legacy support for Q&A pairs
  question: String,
  answer: String,
  targetAudience: {
    type: String,
    enum: ['client', 'vendor', 'general'],
    default: 'general'
  }
}, {
  timestamps: true
});

// Create text index for search
BotKnowledgeSchema.index({ content: 'text', title: 'text', question: 'text', answer: 'text' });

export const BotKnowledge = mongoose.model('BotKnowledge', BotKnowledgeSchema);
