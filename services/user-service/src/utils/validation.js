import Joi from "joi";

// Registration Validation Function
const registrationValidation = (data) => {
  const schema = Joi.object({
    fullName: Joi.string().min(3).max(50).required().messages({
      "string.empty": "Full name cannot be empty.",
      "string.min": "Full name must be at least 3 characters long.",
      "string.max": "Full name cannot exceed 50 characters.",
      "any.required": "Full name is required.",
    }),

    email: Joi.string().email().required().messages({
      "string.email": "Please provide a valid email address.",
      "string.empty": "Email cannot be empty.",
      "any.required": "Email is required.",
    }),
    password: Joi.string().min(6).required().messages({
      "string.empty": "Password cannot be empty.",
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
  });
  return schema.validate(data);
};

const loginValidation = (data) => {
  const schema = Joi.object({
    email: Joi.string().email().required().messages({
      "string.empty": "Password cannot be empty.",
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),

    password: Joi.string().min(6).required().messages({
      "string.empty": "Password cannot be empty.",
      "string.min": "Password must be at least 6 characters long.",
      "any.required": "Password is required.",
    }),
  });
  return schema.validate(data);
};

export { registrationValidation, loginValidation };
