const logger = require("../utils/logger");
const Redis = require("redis");
const redisClient = require("../config/redis");

/**
 * Utility functions for handling server-side question shuffling
 * to prevent cheating while maintaining accurate scoring
 */

/**
 * Create a deterministic but user-specific shuffle using user ID and test ID
 * This ensures the same user gets the same question order across browser refreshes
 * but different users get different orders
 */
function createDeterministicShuffle(array, userId, testId) {
  // Create a seed based on user ID and test ID
  const seed = hashString(userId + testId);

  // Use seeded random for consistent shuffle per user-test combination
  const shuffled = [...array];
  const random = createSeededRandom(seed);

  // Fisher-Yates shuffle with seeded random
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled;
}

/**
 * Simple hash function to convert string to number
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Create a seeded random number generator
 */
function createSeededRandom(seed) {
  let m = 0x80000000; // 2**31
  let a = 1103515245;
  let c = 12345;
  let state = seed ? seed : Math.floor(Math.random() * (m - 1));

  return function () {
    state = (a * state + c) % m;
    return state / (m - 1);
  };
}

/**
 * Shuffle option letters (A/B/C/D) for a single question.
 * Returns shuffledOptions {A,B,C,D} with reassigned text AND
 * optionMap { displayLetter → originalLetter } so scoring can reverse it.
 */
function shuffleOptionsForQuestion(options, userId, testId, questionOriginalIndex) {
  const letters = ["A", "B", "C", "D"];
  // Different seed from question shuffle so the two are independent
  const seed = hashString(`${userId}${testId}opt${questionOriginalIndex}`);
  const random = createSeededRandom(seed);

  const shuffledLetters = [...letters];
  for (let i = shuffledLetters.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffledLetters[i], shuffledLetters[j]] = [shuffledLetters[j], shuffledLetters[i]];
  }

  // shuffledLetters[i] = the original letter whose text goes into display letter letters[i]
  const shuffledOptions = {};
  const optionMap = {}; // displayLetter → originalLetter
  letters.forEach((displayLetter, i) => {
    const originalLetter = shuffledLetters[i];
    shuffledOptions[displayLetter] = options[originalLetter];
    optionMap[displayLetter] = originalLetter;
  });

  return { shuffledOptions, optionMap };
}

/**
 * Shuffle questions with mapping for a specific user and test
 */
function shuffleQuestions(questions, userId, testId) {
  // Add original indices to questions
  const questionsWithIndices = questions.map((q, index) => ({
    ...q,
    originalIndex: index,
  }));

  // Create deterministic shuffle
  const shuffledQuestions = createDeterministicShuffle(
    questionsWithIndices,
    userId,
    testId,
  );

  // Create mapping from shuffled position to original position
  const questionMap = {};
  shuffledQuestions.forEach((q, shuffledIndex) => {
    questionMap[shuffledIndex] = q.originalIndex;
  });

  return {
    shuffledQuestions,
    questionMap,
  };
}

/**
 * Store question + option mappings in Redis or memory fallback
 */
async function storeQuestionMap(userId, testId, questionMap, optionMaps = {}) {
  const key = `question_map:${userId}:${testId}`;
  const mapData = JSON.stringify({ questionMap, optionMaps });

  try {
    if (redisClient && redisClient.isConnected) {
      // Store in Redis with 2 hour expiry (longer than typical test duration)
      await redisClient.setex(key, 7200, mapData);
    } else {
      // Fallback to in-memory storage
      if (!global.questionMaps) {
        global.questionMaps = new Map();
      }
      global.questionMaps.set(key, {
        data: questionMap,
        expires: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
      });

      // Clean up expired maps periodically
      cleanExpiredMaps();
    }
  } catch (error) {
    logger.warn("[ShuffleUtils] Failed to store question map:", error.message);
    // Continue without storing - will use fallback scoring
  }
}

/**
 * Retrieve question + option mappings from Redis or memory fallback.
 * Returns { questionMap, optionMaps } or null.
 */
async function getQuestionMap(userId, testId) {
  const key = `question_map:${userId}:${testId}`;

  try {
    let raw = null;
    if (redisClient && redisClient.isConnected) {
      raw = await redisClient.get(key);
    } else if (global.questionMaps && global.questionMaps.has(key)) {
      const stored = global.questionMaps.get(key);
      if (stored.expires > Date.now()) {
        raw = JSON.stringify(stored.data);
      } else {
        global.questionMaps.delete(key);
      }
    }

    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Handle old format (plain questionMap object) for backward compatibility
    if (parsed && parsed.questionMap) return parsed;
    return { questionMap: parsed, optionMaps: {} };
  } catch (error) {
    logger.warn("[ShuffleUtils] Failed to retrieve question map:", error.message);
  }

  return null;
}

/**
 * Clean up question mapping after test submission
 */
async function cleanupQuestionMap(userId, testId) {
  const key = `question_map:${userId}:${testId}`;

  try {
    if (redisClient && redisClient.isConnected) {
      await redisClient.del(key);
    } else if (global.questionMaps) {
      global.questionMaps.delete(key);
    }
  } catch (error) {
    logger.warn(
      "[ShuffleUtils] Failed to cleanup question map:",
      error.message,
    );
  }
}

/**
 * Clean expired maps from memory fallback
 */
function cleanExpiredMaps() {
  if (!global.questionMaps) return;

  const now = Date.now();
  for (const [key, value] of global.questionMaps.entries()) {
    if (value.expires <= now) {
      global.questionMaps.delete(key);
    }
  }
}

/**
 * Generate a simple non-cryptographic hash to verify answer integrity
 */
function generateAnswerHash(answers, userId, testId) {
  const answerString = answers
    .map((a) => `${a.questionId}:${a.selectedAnswer}`)
    .join("|");
  const combined = `${userId}:${testId}:${answerString}`;
  return hashString(combined).toString();
}

module.exports = {
  shuffleQuestions,
  shuffleOptionsForQuestion,
  storeQuestionMap,
  getQuestionMap,
  cleanupQuestionMap,
  generateAnswerHash,
};

