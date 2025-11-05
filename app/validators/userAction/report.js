// validators/userAction.js
import Joi from "joi";

export const reportUserValidator = Joi.object({
  reason: Joi.string()
    .valid("spam", "harassment", "fake_profile", "inappropriate_content", "scam", "other")
    .required()
    .messages({
      "any.only": "Reason must be one of: spam, harassment, fake_profile, inappropriate_content, scam, or other.",
      "any.required": "Reason is required.",
    }),
  details: Joi.string()
    .allow("") 
    .max(500)
    .messages({
      "string.base": "Details must be a string.",
      "string.max": "Details cannot exceed 500 characters.",
    }),
});
