// models/Book.js
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
  comments: {
    type: [String], // You can later change this to a more complex schema if needed
    default: [],
  },
}, {
  timestamps: true // automatically adds createdAt and updatedAt
});

const Book = mongoose.model('Book', bookSchema);

export default Book;
