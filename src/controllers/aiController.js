const OpenAI = require("openai");
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// @route   POST /api/ai/chat
// @desc    Chat with AI assistant
// @access  Private
exports.chat = async (req, res) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    // Prepare messages for OpenAI
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

    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiResponse = completion.choices[0].message.content;

    res.json({
      success: true,
      data: {
        response: aiResponse,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("OpenAI Error:", error);
    res.status(500).json({
      success: false,
      message: "AI service temporarily unavailable",
      error: error.message,
    });
  }
};

// @route   POST /api/ai/explain
// @desc    Explain a concept or answer
// @access  Private
exports.explain = async (req, res) => {
  try {
    const { topic, context } = req.body;

    if (!topic) {
      return res.status(400).json({
        success: false,
        message: "Topic is required",
      });
    }

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

    res.json({
      success: true,
      data: {
        explanation: completion.choices[0].message.content,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Explanation service unavailable",
      error: error.message,
    });
  }
};
