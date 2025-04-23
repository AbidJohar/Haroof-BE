 // models/Writer.js
 import mongoose from 'mongoose';

 const writerSchema = new mongoose.Schema({
   fullName: {
     type: String,
     required: true,
     trim: true
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
   }
 }, {
   timestamps: true // adds createdAt & updatedAt automatically
 });
 
 const Writer = mongoose.model('Writer', writerSchema);
 
 export default Writer;
 