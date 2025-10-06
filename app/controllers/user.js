import { User } from '../models/user.js';
import { userRegistrationValidator } from '../validators/user.js';
import crypto from 'crypto';
import { sendOTPEmail } from '../utils/helper.js';
import { handleResponse } from '../utils/helper.js';
import { generateToken } from "../middlewares/jwtAuth.js";
import jwt from 'jsonwebtoken';

// Verify Email and Send OTP for Registration/Login
const verifyEmailForOTP = async (req, res) => {
  const { email } = req.body;

  // Check if user already exists
  let user = await User.findOne({ email });

  const otp = crypto.randomBytes(3).toString('hex');

  // If user exists, send OTP for login and mark isNewUser as false
  if (user) {
    user.otp = otp; // Store OTP in the user's record
    user.isNewUser = false; // Mark as existing user

    await sendOTPEmail(email, otp); // Send OTP to the user's email
    await user.save(); // Save OTP in the user's record

    return handleResponse(res, 200, 'OTP sent to your email. Please verify to log in.');
  }

  // If user doesn't exist, create a new user for registration and mark isNewUser as true
  const newUser = new User({
    email,
    otp,
    isVerified: false, // Initially false, because they haven't verified yet
    isNewUser: true, // New user flag
  });

  await sendOTPEmail(email, otp); // Send OTP to the user's email
  await newUser.save(); // Save new user with OTP

  return handleResponse(res, 200, 'OTP sent to your email for verification.');
};
/*
const completeRegistrationAfterEmailVerification = async (req, res) => {

  // Ensure required fields are provided in form-data
  const { name, gender, date_of_birth, brings_to, height, really_into, value_in_a_person, lifestyles_and_habits, important_in_your_life, first_prompt, second_prompt, third_prompt, like_to_meet, hoping_to_find, mobile_number, shown_as } = req.body;

  if (!name || !gender || !date_of_birth || !brings_to) {
    return handleResponse(res, 400, 'Name, gender, date_of_birth, and brings_to are required.');
  }

  // Get token from headers (Bearer Token)
  const token = req.header("Authorization")?.replace("Bearer ", "");

  // Decode the JWT token to get user ID
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    return handleResponse(res, 400, 'Invalid or expired token.');
  }

  // Find the user by ID (from the decoded token)
  let user = await User.findById(decodedToken.userId);

  if (!user || !user.isNewUser) {
    return handleResponse(res, 404, 'User not found or not a new user.');
  }

  // Update the user's details from the request body
  user.name = name;
  user.gender = gender;
  user.date_of_birth = date_of_birth;
  user.brings_to = brings_to;

  // Convert string to appropriate data types
  if (height) user.height = parseInt(height); // ensure height is a number
  if (shown_as) user.shown_as = shown_as === 'true';  // Convert string 'true'/'false' to boolean
  if (mobile_number) user.mobile_number = mobile_number;  // Ensure mobile number is saved as a string

  // Handle array fields (split by commas)
  if (really_into && really_into.trim()) {
    user.really_into = really_into.split(',');  // Split string into an array
  }

  if (value_in_a_person && value_in_a_person.trim()) {
    user.value_in_a_person = value_in_a_person.split(',');  // Split string into an array
  }

  if (lifestyles_and_habits && lifestyles_and_habits.trim()) {
    user.lifestyles_and_habits = lifestyles_and_habits.split(',');  // Split string into an array
  }

  if (important_in_your_life && important_in_your_life.trim()) {
    user.important_in_your_life = important_in_your_life.split(',');  // Split string into an array
  }

  if (like_to_meet && like_to_meet.trim()) {
    user.like_to_meet = like_to_meet.split(',');  // Split string into an array
  }

  if (hoping_to_find && hoping_to_find.trim()) {
    user.hoping_to_find = hoping_to_find.split(',');  // Split string into an array
  }

  if (first_prompt) user.first_prompt = first_prompt;
  if (second_prompt) user.second_prompt = second_prompt;
  if (third_prompt) user.third_prompt = third_prompt;

  // If images are uploaded, add them to the user
  if (req.convertedFiles && req.convertedFiles.images) {
    user.images = req.convertedFiles.images;
  }

  // Mark user as verified and update status
  user.isVerified = true;
  user.isNewUser = false;  // Set isNewUser to false since the user has completed the registration
  user.otp = '';  // Clear OTP after verification

  await user.save();  // Save the updated user details

  // Generate JWT token for the newly registered user
  const updatedToken = generateToken(user._id, user.email);

  return handleResponse(res, 200, 'Email verified and registration complete.', { token: updatedToken });
};
*/

const completeRegistrationAfterEmailVerification = async (req, res) => {
  // First, validate the request body using Joi
  const { error } = userRegistrationValidator.validate(req.body);

  // If there is a validation error, return the error message
  if (error) {
    return handleResponse(res, 400, error.details[0].message);
  }

  // Proceed with the existing logic after successful validation
  const { name, gender, date_of_birth, brings_to, height, really_into, value_in_a_person, lifestyles_and_habits, important_in_your_life, first_prompt, second_prompt, third_prompt, like_to_meet, hoping_to_find, mobile_number, shown_as } = req.body;

  if (!name || !gender || !date_of_birth || !brings_to) {
    return handleResponse(res, 400, 'Name, gender, date_of_birth, and brings_to are required.');
  }

  // Get token from headers (Bearer Token)
  const token = req.header("Authorization")?.replace("Bearer ", "");

  // Decode the JWT token to get user ID
  let decodedToken;
  try {
    decodedToken = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
  } catch (error) {
    return handleResponse(res, 400, 'Invalid or expired token.');
  }

  // Find the user by ID (from the decoded token)
  let user = await User.findById(decodedToken.userId);

  if (!user || !user.isNewUser) {
    return handleResponse(res, 404, 'User not found or not a new user.');
  }

  // Update the user's details from the request body
  user.name = name;
  user.gender = gender;
  user.date_of_birth = date_of_birth;
  user.brings_to = brings_to;

  // Convert string to appropriate data types
  if (height) user.height = parseInt(height); // ensure height is a number
  if (shown_as) user.shown_as = shown_as === 'true';  // Convert string 'true'/'false' to boolean
  if (mobile_number) user.mobile_number = mobile_number;  // Ensure mobile number is saved as a string

  // Handle array fields (split by commas)
  if (really_into && typeof really_into === 'string' && really_into.trim()) {
    user.really_into = really_into.split(',');  // Split string into an array
  } else if (Array.isArray(really_into)) {
    user.really_into = really_into;  // Already an array, no need to split
  }

  if (value_in_a_person && typeof value_in_a_person === 'string' && value_in_a_person.trim()) {
    user.value_in_a_person = value_in_a_person.split(',');  // Split string into an array
  } else if (Array.isArray(value_in_a_person)) {
    user.value_in_a_person = value_in_a_person;  // Already an array, no need to split
  }

  if (lifestyles_and_habits && typeof lifestyles_and_habits === 'string' && lifestyles_and_habits.trim()) {
    user.lifestyles_and_habits = lifestyles_and_habits.split(',');  // Split string into an array
  } else if (Array.isArray(lifestyles_and_habits)) {
    user.lifestyles_and_habits = lifestyles_and_habits;  // Already an array, no need to split
  }

  if (important_in_your_life && typeof important_in_your_life === 'string' && important_in_your_life.trim()) {
    user.important_in_your_life = important_in_your_life.split(',');  // Split string into an array
  } else if (Array.isArray(important_in_your_life)) {
    user.important_in_your_life = important_in_your_life;  // Already an array, no need to split
  }

  if (like_to_meet && typeof like_to_meet === 'string' && like_to_meet.trim()) {
    user.like_to_meet = like_to_meet.split(',');  // Split string into an array
  } else if (Array.isArray(like_to_meet)) {
    user.like_to_meet = like_to_meet;  // Already an array, no need to split
  }

  if (hoping_to_find && typeof hoping_to_find === 'string' && hoping_to_find.trim()) {
    user.hoping_to_find = hoping_to_find.split(',');  // Split string into an array
  } else if (Array.isArray(hoping_to_find)) {
    user.hoping_to_find = hoping_to_find;  // Already an array, no need to split
  }

  if (first_prompt) user.first_prompt = first_prompt;
  if (second_prompt) user.second_prompt = second_prompt;
  if (third_prompt) user.third_prompt = third_prompt;

  // If images are uploaded, add them to the user
  if (req.convertedFiles && req.convertedFiles.images) {
    user.images = req.convertedFiles.images;
  }

  // Mark user as verified and update status
  user.isVerified = true;
  user.isNewUser = false;  // Set isNewUser to false since the user has completed the registration
  user.otp = '';  // Clear OTP after verification

  await user.save();  // Save the updated user details

  // Generate JWT token for the newly registered user
  const updatedToken = generateToken(user._id, user.email);

  return handleResponse(res, 200, 'Email verified and registration complete.', { token: updatedToken });
};


// Log in User with OTP and return isNewUser status
const loginUserWithOTP = async (req, res) => {
  const { email, otp } = req.body;

  // Find the user by email
  let user = await User.findOne({ email });

  if (!user) {
    return handleResponse(res, 404, 'Email not found.');
  }

  // Check if OTP matches
  if (user.otp !== otp) {
    return handleResponse(res, 400, 'Invalid OTP. Please try again.');
  }

  // If user is new, mark them as verified and provide the token
  if (user.isNewUser) {
    user.isVerified = true;
    user.otp = ''; // Clear OTP after verification
    await user.save(); // Mark user as verified

    // Generate JWT token for the new user
    const token = generateToken(user._id, user.email);

    return handleResponse(res, 200, 'Logged in successfully and verified as new user.', { token, isNewUser: user.isNewUser });
  }

  // If existing user, clear OTP and log them in
  user.otp = ''; // Clear OTP after successful verification
  await user.save();

  // Generate JWT token for the existing user
  const token = generateToken(user._id, user.email);

  return handleResponse(res, 200, 'Logged in successfully via OTP.', { token, isNewUser: user.isNewUser });
};

export const user = {
  verifyEmailForOTP,
  completeRegistrationAfterEmailVerification,
  loginUserWithOTP,
};
