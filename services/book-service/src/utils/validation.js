import Joi from "joi";

// Book Validation Function
const bookValidation = (data) => {
  const schema = Joi.object({
    title: Joi.string().trim().required().messages({
      "string.empty": "Title cannot be empty.",
      "any.required": "Title is required.",
    }),

    description: Joi.string().allow("", null).messages({
      "string.base": "Description must be a string.",
    }),
    content: Joi.string().max(10000).allow("", null).messages({
      "string.base": "content is not more than 10,000 words.",
    }),

    category: Joi.string().allow("", null).messages({
      "string.base": "Category must be a string.",
    }),

    // coverImage: Joi.string().uri().allow("", null).messages({
    //   "string.uri": "Cover image must be a valid URL.",
    // }),
  });

  return schema.validate(data);
};

export { bookValidation };
