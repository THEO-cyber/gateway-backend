// Test scoring debug script to verify scoring logic
// Run this with: node debug-test-scoring.js

const mongoose = require("mongoose");

// Mock test data for verification with MongoDB ObjectIds (like real database)
const mockTest = {
  _id: "699c4f6871ec0fb6eb31902a",
  questions: [
    {
      _id: "699c531d8465838ad17b5068",
      question: "Question 1",
      correctAnswer: "C",
    },
    {
      _id: "699c531d8465838ad17b5069",
      question: "Question 2",
      correctAnswer: "C",
    },
    {
      _id: "699c531d8465838ad17b506a",
      question: "Question 3",
      correctAnswer: "B",
    },
    {
      _id: "699c531d8465838ad17b506b",
      question: "Question 4",
      correctAnswer: "B",
    },
    {
      _id: "699c531d8465838ad17b506c",
      question: "Question 5",
      correctAnswer: "C",
    },
    {
      _id: "699c531d8465838ad17b506d",
      question: "Question 6",
      correctAnswer: "A",
    },
    {
      _id: "699c531d8465838ad17b506e",
      question: "Question 7",
      correctAnswer: "D",
    },
    {
      _id: "699c531d8465838ad17b506f",
      question: "Question 8",
      correctAnswer: "B",
    },
    {
      _id: "699c531d8465838ad17b5070",
      question: "Question 9",
      correctAnswer: "A",
    },
    {
      _id: "699c531d8465838ad17b5071",
      question: "Question 10",
      correctAnswer: "C",
    },
  ],
};

// Mock answers using MongoDB ObjectId format (as sent by frontend)
const mockAnswersObjectId = [
  { questionId: "699c531d8465838ad17b5068", selectedAnswer: "C" }, // Correct
  { questionId: "699c531d8465838ad17b5069", selectedAnswer: "C" }, // Correct
  { questionId: "699c531d8465838ad17b506a", selectedAnswer: "B" }, // Correct
  { questionId: "699c531d8465838ad17b506b", selectedAnswer: "B" }, // Correct
  { questionId: "699c531d8465838ad17b506c", selectedAnswer: "C" }, // Correct
  { questionId: "699c531d8465838ad17b506d", selectedAnswer: "A" }, // Correct
  { questionId: "699c531d8465838ad17b506e", selectedAnswer: "D" }, // Correct
  { questionId: "699c531d8465838ad17b506f", selectedAnswer: "B" }, // Correct
  { questionId: "699c531d8465838ad17b5070", selectedAnswer: "A" }, // Correct
  { questionId: "699c531d8465838ad17b5071", selectedAnswer: "X" }, // Wrong - should be C
];

// Mock answers using numeric index format (backward compatibility)
const mockAnswersNumeric = [
  { questionId: 0, selectedAnswer: "C" }, // Correct
  { questionId: 1, selectedAnswer: "C" }, // Correct
  { questionId: 2, selectedAnswer: "B" }, // Correct
  { questionId: 3, selectedAnswer: "B" }, // Correct
  { questionId: 4, selectedAnswer: "C" }, // Correct
  { questionId: 5, selectedAnswer: "A" }, // Correct
  { questionId: 6, selectedAnswer: "D" }, // Correct
  { questionId: 7, selectedAnswer: "B" }, // Correct
  { questionId: 8, selectedAnswer: "A" }, // Correct
  { questionId: 9, selectedAnswer: "X" }, // Wrong - should be C
];

// Test the new scoring logic with ObjectId support
function testScoringLogic(test, answers, format = "unknown") {
  console.log(`=== TESTING SCORING LOGIC - ${format.toUpperCase()} FORMAT ===`);
  console.log(`Test has ${test.questions.length} questions`);
  console.log(`Submitted ${answers.length} answers`);

  const validAnswers = [];
  for (let i = 0; i < answers.length; i++) {
    const answer = answers[i];
    if (!answer) continue;

    let questionId = null;
    let selectedAnswer = null;
    let questionIndex = null;

    // Format 1: {questionId: MongoDB ObjectId string, selectedAnswer: string}
    if (answer.questionId && answer.selectedAnswer) {
      // If questionId is a MongoDB ObjectId string, find matching question by _id
      if (
        typeof answer.questionId === "string" &&
        answer.questionId.length === 24
      ) {
        questionIndex = test.questions.findIndex(
          (q) => q._id && q._id.toString() === answer.questionId,
        );
        if (questionIndex >= 0) {
          questionId = questionIndex; // Use found index
          selectedAnswer = answer.selectedAnswer;
        }
      }
      // If questionId is numeric, use directly
      else if (!isNaN(answer.questionId)) {
        questionId = parseInt(answer.questionId);
        selectedAnswer = answer.selectedAnswer;
      }
    }
    // Format 2: {question: number, answer: string} (old format)
    else if (answer.question !== undefined && answer.answer) {
      questionId = parseInt(answer.question);
      selectedAnswer = answer.answer;
    }
    // Format 3: Direct array with index-based answers
    else if (typeof answer === "string") {
      questionId = i;
      selectedAnswer = answer;
    }

    if (questionId !== null && selectedAnswer) {
      validAnswers.push({
        questionId: questionId,
        selectedAnswer: selectedAnswer.trim(),
        originalIndex: i,
        originalQuestionObjectId: answer.questionId,
      });
    }
  }

  console.log(`\nProcessing ${validAnswers.length} valid answers:`);

  let score = 0;
  const totalQuestions = test.questions.length;

  for (const answer of validAnswers) {
    let questionIndex = answer.questionId;

    // Validate question index is within bounds
    if (questionIndex >= 0 && questionIndex < totalQuestions) {
      const question = test.questions[questionIndex];
      const isCorrect =
        question && question.correctAnswer === answer.selectedAnswer;

      if (isCorrect) {
        score++;
        console.log(
          `✓ Q${questionIndex + 1}: ${answer.selectedAnswer} (correct) [${answer.originalQuestionObjectId}]`,
        );
      } else if (question) {
        console.log(
          `✗ Q${questionIndex + 1}: ${answer.selectedAnswer} (correct: ${question.correctAnswer}) [${answer.originalQuestionObjectId}]`,
        );
      }
    } else {
      console.warn(
        `Invalid question index: ${questionIndex} for ObjectId: ${answer.originalQuestionObjectId}`,
      );
    }
  }

  const percentage =
    totalQuestions > 0
      ? Math.round((score / totalQuestions) * 100 * 100) / 100
      : 0;

  // Calculate grade based on percentage
  let grade = "F";
  if (percentage >= 90) grade = "A";
  else if (percentage >= 80) grade = "B";
  else if (percentage >= 70) grade = "C";
  else if (percentage >= 60) grade = "D";
  else if (percentage >= 50) grade = "E";

  console.log(`\n=== FINAL RESULTS - ${format.toUpperCase()} ===`);
  console.log(`Score: ${score}/${totalQuestions}`);
  console.log(`Percentage: ${percentage}%`);
  console.log(`Grade: ${grade}`);

  return { score, totalQuestions, percentage, grade, format };
}

// Run the tests for both formats
console.log("\n" + "=".repeat(60));
console.log("TESTING MONGODB OBJECTID FORMAT (Current Issue)");
console.log("=".repeat(60));
const resultsObjectId = testScoringLogic(
  mockTest,
  mockAnswersObjectId,
  "MongoDB ObjectId",
);

console.log("\n" + "=".repeat(60));
console.log("TESTING NUMERIC INDEX FORMAT (Backward Compatibility)");
console.log("=".repeat(60));
const resultsNumeric = testScoringLogic(
  mockTest,
  mockAnswersNumeric,
  "Numeric Index",
);

console.log("\n" + "=".repeat(60));
console.log("VERIFICATION SUMMARY");
console.log("=".repeat(60));

console.log(
  `\nObjectId Format: ${resultsObjectId.score}/${resultsObjectId.totalQuestions} (${resultsObjectId.percentage}%) - Grade: ${resultsObjectId.grade}`,
);
console.log(
  `Numeric Format:  ${resultsNumeric.score}/${resultsNumeric.totalQuestions} (${resultsNumeric.percentage}%) - Grade: ${resultsNumeric.grade}`,
);

if (
  resultsObjectId.score === 9 &&
  resultsObjectId.percentage === 90 &&
  resultsObjectId.grade === "A" &&
  resultsNumeric.score === 9 &&
  resultsNumeric.percentage === 90 &&
  resultsNumeric.grade === "A"
) {
  console.log("\n✅ SUCCESS: Both scoring formats work correctly!");
  console.log("✅ ObjectId mapping issue has been FIXED!");
} else {
  console.log("\n❌ FAILURE: Scoring logic still needs fixes!");
  console.log(`Expected: 9/10 (90%) Grade A`);
  console.log(
    `ObjectId Got: ${resultsObjectId.score}/10 (${resultsObjectId.percentage}%) Grade ${resultsObjectId.grade}`,
  );
  console.log(
    `Numeric Got: ${resultsNumeric.score}/10 (${resultsNumeric.percentage}%) Grade ${resultsNumeric.grade}`,
  );
}
