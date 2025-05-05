 import Joi from 'joi';

// Book Validation Function
const bookValidation = (data) => {
  const schema = Joi.object({
    title: Joi.string().trim().required().messages({
      'string.empty': 'Title cannot be empty.',
      'any.required': 'Title is required.',
    }),
    description: Joi.string().allow('', null).messages({
      'string.base': 'Description must be a string.',
    }),
    content: Joi.string().max(10000).allow('', null).messages({
      'string.base': 'Content is not more than 10,000 words.',
    }),
    category: Joi.string().allow('', null).messages({
      'string.base': 'Category must be a string.',
    }),
    // coverImage: Joi.string().uri().allow('', null).messages({
    //   'string.uri': 'Cover image must be a valid URL.',
    // }),
  });

  return schema.validate(data);
};

// Writer Validation Function
const writerValidation = (data) => {
  const schema = Joi.object({
    fullName: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'Full name is required',
        'string.empty': 'Full name cannot be empty',
        'string.min': 'Full name must be at least 1 character long',
      }),
    // writerProfileImage: Joi.string()
    //   .required()
    //   .messages({
    //     'any.required': 'Writer profile image is required',
    //     'string.empty': 'Writer profile image cannot be empty',
    //   }),
    bio: Joi.string()
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.base': 'Bio must be a valid string',
      }),
    email: Joi.string()
      .email({ tlds: { allow: false } })
      .required()
      .lowercase()
      .trim()
      .messages({
        'any.required': 'A valid email is required',
        'string.email': 'Email must be a valid email address',
        'string.empty': 'Email cannot be empty',
      }),
    paymentAccountNumber: Joi.number()
      .required()
      .integer()
      .positive()
      .messages({
        'any.required': 'A valid payment account number is required',
        'number.base': 'Payment account number must be a number',
        'number.integer': 'Payment account number must be an integer',
        'number.positive': 'Payment account number must be positive',
      }),
    addressLine: Joi.string()
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.base': 'Address line must be a valid string',
      }),
    city: Joi.string()
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.base': 'City must be a valid string',
      }),
    state: Joi.string()
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.base': 'State must be a valid string',
      }),
    postalCode: Joi.number()
      .integer()
      .positive()
      .optional()
      .allow(null)
      .messages({
        'number.base': 'Postal code must be a valid number',
        'number.integer': 'Postal code must be an integer',
        'number.positive': 'Postal code must be positive',
      }),
    country: Joi.string()
      .trim()
      .allow('')
      .optional()
      .messages({
        'string.base': 'Country must be a valid string',
      }),
  });

  return schema.validate(data);
};

export { bookValidation, writerValidation };