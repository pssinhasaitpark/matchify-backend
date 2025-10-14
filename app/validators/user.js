// //app/validators/user.js
import Joi from "joi";

export const userRegistrationValidator = Joi.object({
  fullName: Joi.string().min(3).max(50).required().messages({
    "string.empty": "Full name is required.",
    "string.min": "Full name must be at least 3 characters.",
    "string.max": "Full name cannot exceed 50 characters.",
    "any.required": "Full name is required.",
  }),
  dob: Joi.string()
    .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
    .required()
    .messages({
    "string.pattern.base": "Date of birth must be in DD/MM/YYYY format.",
    "any.required": "Date of birth is required.",
  }),
  gender: Joi.string().valid("male", "female", "other").required().messages({
    "any.only": "Gender must be one of male, female, or other.",
    "any.required": "Gender is required.",
  }),

  sexual_orientation: Joi.string().valid("straight", "gay", "bisexual", "other").optional(),

  location: Joi.alternatives()
    .try(
      Joi.string().pattern(/^[-+]?[0-9]*\.?[0-9]+,[-+]?[0-9]*\.?[0-9]+$/),
      Joi.object({
        type: Joi.string().valid("Point").required(),
        coordinates: Joi.array().items(Joi.number()).length(2),
      })
    )
    .required().messages({
    "any.required": "Location is required.",
    "string.pattern.base": "Location must be a valid coordinate string or object.",
  }),

  preferred_match_distance: Joi.number().min(1).max(500).optional(),

  show_me: Joi.string().valid("men", "women", "everyone").optional(),

  age_range: Joi.alternatives()
    .try(
      Joi.array().items(Joi.number().min(18).max(100)).length(2),
      Joi.string().pattern(/^\d{1,2}[-,]\d{1,2}$/)
    )
    .optional(),

  height: Joi.number().min(4).max(250).optional(),
  body_type: Joi.string().optional(),
  education: Joi.string().optional(),
  profession: Joi.string().optional(),

  bio: Joi.string().optional(),
  interest: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).optional(),

  smoking: Joi.string().valid("Yes", "No", "Sometimes").optional(),
  drinking: Joi.string().valid("Yes", "No", "Socially").optional(),
  diet: Joi.string().valid("None", "Vegan", "Vegetarian", "Halal", "Kosher", "Other").optional(),
  religion: Joi.string().optional(),
  caste: Joi.string().optional(),
  hasKids: Joi.string().valid("Yes", "No", "Prefer not to say").optional(),
  wantsKids: Joi.string().valid("Yes", "No", "Maybe").optional(),
  hasPets: Joi.alternatives().try(Joi.boolean(), Joi.string()).optional(),
  relationshipGoals: Joi.string()
    .valid("CasualDating", "SeriousRelationship", "Marriage", "OpenToExplore")
    .optional(),

  images: Joi.array().items(Joi.string().uri()).optional(),
  mobile_number: Joi.string()
    .length(10)
    .pattern(/^[6-9]\d{9}$/)
    .required()
    .messages({
      "string.length": "Mobile Number must be exactly 10 Digits",
      "string.pattern.base": "Please enter a proper valid mobile number.",
      "any.required": "Mobile number is required.",
    }),

});
