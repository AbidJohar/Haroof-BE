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
    paymentAccountNumber: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'Payment account number is required',
        'string.empty': 'Payment account number cannot be empty',
        'string.min': 'Payment account number must be at least 1 character long',
      }),
    addressLine: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'Address line is required',
        'string.empty': 'Address line cannot be empty',
        'string.min': 'Address line must be at least 1 character long',
      }),
    city: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'City is required',
        'string.empty': 'City cannot be empty',
        'string.min': 'City must be at least 1 character long',
      }),
    state: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'State is required',
        'string.empty': 'State cannot be empty',
        'string.min': 'State must be at least 1 character long',
      }),
    postalCode: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'Postal code is required',
        'string.empty': 'Postal code cannot be empty',
        'string.min': 'Postal code must be at least 1 character long',
      }),
    country: Joi.string()
      .required()
      .trim()
      .min(1)
      .messages({
        'any.required': 'Country is required',
        'string.empty': 'Country cannot be empty',
        'string.min': 'Country must be at least 1 character long',
      }),
  });

  return schema.validate(data);
};

export { bookValidation, writerValidation };