 // models/Writer.js
 import mongoose from 'mongoose';

 const writerSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    unique: true, // Ensures one writer per user
  },
   fullName: {
     type: String,
     required: true,
     trim: true
   },
   writerProfileImage: {
    type: String,
    required:true
   },
   bio: {
     type: String,
     trim: true
   },
   email: {
     type: String,
     required: true,
     unique: true,
     lowercase: true,
     trim: true
   },
   paymentAccountNumber: {
     type: Number,
     required: true
   },
   addressLine: {
     type: String,
     trim: true
   },
   city: {
     type: String,
     trim: true
   },
   state: {
     type: String,
     trim: true
   },
   postalCode: {
     type: Number
   },
   country: {
     type: String,
     trim: true
   },
   books: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Book',
    default: []
  }],
  followers: {
    type: Number,
    default: 0,
    min: 0,  
  },
  writerAccessToken: { type: String }, // New field for storing token
 }, {
   timestamps: true // adds createdAt & updatedAt automatically
 });
 
 const Writer = mongoose.model('Writer', writerSchema);
 
 export default Writer;
 