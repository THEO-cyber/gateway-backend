const OpenAI = require("openai");
const logger = require("../utils/logger");

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generate AI chat response
 * @param {string} message - User's message
 * @param {Array} conversationHistory - Previous conversation messages
 * @returns {Promise<string>} - AI response
 */
exports.generateChatResponse = async (message, conversationHistory = []) => {
  try {
    const messages = [
      {
        role: "system",
        content:
          "You are an educational assistant for HND Gateway, helping students with academic questions, past papers, and study guidance. Be helpful, concise, and encouraging.",
      },
      ...conversationHistory,
      {
        role: "user",
        content: message,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error(`OpenAI Chat Error: ${error.message}`);
    throw new Error("AI service temporarily unavailable");
  }
};

/**
 * Generate explanation for a topic
 * @param {string} topic - Topic to explain
 * @param {string} context - Optional context
 * @returns {Promise<string>} - Explanation
 */
exports.generateExplanation = async (topic, context = null) => {
  try {
    const prompt = context
      ? `Explain "${topic}" in the context of: ${context}`
      : `Explain "${topic}" in simple terms for a student.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a teacher explaining concepts clearly and simply.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 400,
      temperature: 0.5,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error(`OpenAI Explanation Error: ${error.message}`);
    throw new Error("AI service temporarily unavailable");
  }
};

/**
 * Generate study tips for a subject
 * @param {string} subject - Subject name
 * @returns {Promise<string>} - Study tips
 */
exports.generateStudyTips = async (subject) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a study coach providing practical study tips.",
        },
        {
          role: "user",
          content: `Give me 5 effective study tips for ${subject}`,
        },
      ],
      max_tokens: 300,
      temperature: 0.6,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error(`OpenAI Study Tips Error: ${error.message}`);
    throw new Error("AI service temporarily unavailable");
  }
};

/**
 * Summarize a long text
 * @param {string} text - Text to summarize
 * @returns {Promise<string>} - Summary
 */
exports.summarizeText = async (text) => {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that creates concise summaries.",
        },
        {
          role: "user",
          content: `Summarize the following text:\n\n${text}`,
        },
      ],
      max_tokens: 250,
      temperature: 0.5,
    });

    return completion.choices[0].message.content;
  } catch (error) {
    logger.error(`OpenAI Summarize Error: ${error.message}`);
    throw new Error("AI service temporarily unavailable");
  }
};

module.exports = exports;
