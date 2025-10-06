// //app/models/user.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  name: { type: String, required: false },
  date_of_birth: { type: String, required: false },
  gender: { type: String, enum: ['male', 'female', 'other'], required: false },
  shown_as: { type: Boolean, default: false },
  mobile_number: { type: String, default: null },
  brings_to: { type: String, enum: ['date', 'bff'], required: false },
  like_to_meet: { type: [String], enum: ['men', 'women', 'other', 'all'], required: false },
  hoping_to_find: { type: [String], required: false },
  height: { type: Number, default: null },
  really_into: { type: [String], default: [] },
  value_in_a_person: { type: [String], default: [] },
  lifestyles_and_habits: { type: [String], default: [] },
  important_in_your_life: { type: [String], default: [] },
  first_prompt: { type: String, default: '' },
  second_prompt: { type: String, default: '' },
  third_prompt: { type: String, default: '' },
  images: { type: [String], required: false },
  isVerified: { type: Boolean, default: false },
  otp: { type: String, default: null },
  isNewUser: { type: Boolean, default: true },
});

export const User = mongoose.model('User', userSchema);
