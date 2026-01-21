import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  profilePicture: { type: String },
  role: { type: String, default: 'admin' },
  createdAt: { type: Date, default: Date.now }
});

export const Admin = mongoose.model('Admin', AdminSchema);
