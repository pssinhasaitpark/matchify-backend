//app/validators/user.js
import Joi from 'joi';

export const userRegistrationValidator = Joi.object({

  name: Joi.string()
    .min(3)
    .max(30)
    .optional()
    .messages({
      "string.empty": "Name is required.",
      "string.min": "Name must be at least 3 characters.",
      "string.max": "Name must be at most 30 characters.",
    }),

  date_of_birth: Joi.string()
    .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
    .optional()
    .messages({
      "string.empty": "Date of birth is required.",
      "string.pattern.base": "Date of birth must be in the format DD/MM/YYYY.",
    }),

  gender: Joi.string()
    .valid('male', 'female', 'other')
    .optional()
    .messages({
      "string.empty": "Gender is required.",
      "any.only": "Gender must be one of 'male', 'female', or 'other'.",
    }),

  shown_as: Joi.boolean()
    .default(false)
    .messages({
      "boolean.base": "Shown as must be a boolean value.",
    }),

  mobile_number: Joi.string()
    .length(10)
    .pattern(/^[0-9]+$/)
    .optional()
    .messages({
      "string.empty": "Mobile number is required.",
      "string.length": "Mobile number must be exactly 10 digits.",
      "string.pattern.base": "Mobile number must contain only digits.",
    }),

  brings_to: Joi.string()
    .valid('date', 'bff')
    .optional()
    .messages({
      "string.empty": "Brings to is required.",
      "any.only": "Brings to must be one of 'date' or 'bff'.",
    }),

  like_to_meet: Joi.string().valid('men', 'women', 'other', 'all')
    .min(1)
    .optional()
    .messages({
      "array.empty": "Like to meet is required.",
      "array.min": "At least one option must be selected for 'Like to meet'.",
    }),

  hoping_to_find: Joi.array()
  .items(Joi.string())
  .min(2)
  .optional()
  .messages({
    "array.base": "Hoping to find must be an array.",
    "array.min": "At least two options must be selected for 'Hoping to find'.",
  }),


  height: Joi.number()
    .min(0)
    .optional()
    .messages({
      "number.base": "Height must be a number.",
      "number.min": "Height must be a positive value.",
    }),

 really_into: Joi.array()
  .items(Joi.string())
  .min(1) // You can change this to .min(1) if you want at least one option
  .optional()
  .messages({
    "array.base": "Really into must be an array.",
    "array.min": "At least one option must be selected for 'Really into'.",
  }),

value_in_a_person: Joi.array()
  .items(Joi.string())
  .min(1) // You can change this to .min(1) if you want at least one option
  .optional()
  .messages({
    "array.base": "Value in a person must be an array.",
    "array.min": "At least one option must be selected for 'Value in a person'.",
  }),


  lifestyles_and_habits: Joi.array()
  .items(Joi.string())
  .optional()
  .messages({
    "array.base": "Lifestyles and habits must be an array.",
  }),

important_in_your_life: Joi.array()
  .items(Joi.string())
  .optional()
  .messages({
    "array.base": "Important in your life must be an array.",
  }),


  first_prompt: Joi.string()
    .optional()
    .allow('')
    .messages({
      "string.base": "First prompt must be a string.",
    }),

  second_prompt: Joi.string()
    .optional()
    .allow('')
    .messages({
      "string.base": "Second prompt must be a string.",
    }),

  third_prompt: Joi.string()
    .optional()
    .allow('')
    .messages({
      "string.base": "Third prompt must be a string.",
    }),

  images: Joi.array()
    .items(Joi.string().uri())
    .length(6)
    .optional()
    .messages({
      "array.base": "Images must be an array of URLs.",
      "array.length": "Exactly 6 images are required.",
      "array.empty": "Images are required.",
    }),

  isNewUser: Joi.boolean()
    .default(true)
    .messages({
      "boolean.base": "isNewUser must be a boolean value.",
    }),
});
