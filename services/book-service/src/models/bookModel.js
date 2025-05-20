import mongoose from 'mongoose';

const bookSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  authorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Writer',
    required: true,
  },
  description: {
    type: String,
    trim: true,
  },
  category: {
    type: String,
    trim: true,
  },
  content: {
    type: String,
    required: true,
  },
  contentKey: {
    type: String,
  },
  contentIV: {
    type: String,
  },
  coverImage: {
    type: String,
  },
  readByUsers: {
    type: Number,
    default: 0,
  },
  likes: {
    type: Number,
    default: 0,
  },
  dislikes: {
    type: Number,
    default: 0,
  },
  comments: {
    type: [String],
    default: [],
  },
  status: { type: String, enum: ['approved', 'pending', 'rejected'], default: 'pending' },
  isPublished: {
    type: Boolean,
    default: false,
  },
  isDraft: { type: Boolean, default: false },
  lastEdited: { type: Date },
}, {
  timestamps: true,
});

const Book = mongoose.model('Book', bookSchema);

export default Book;