// Quick test of the ObjectId matching logic
const testQuestions = [
  { _id: "699c531d8465838ad17b5068", correctAnswer: "C" },
  { _id: "699c531d8465838ad17b5069", correctAnswer: "C" },
  { _id: "699c531d8465838ad17b506a", correctAnswer: "B" },
];

const testAnswers = [
  { questionId: "699c531d8465838ad17b5068", selectedAnswer: "C" }, // Should be correct
  { questionId: "699c531d8465838ad17b5069", selectedAnswer: "C" }, // Should be correct
  { questionId: "699c531d8465838ad17b506a", selectedAnswer: "A" }, // Should be wrong (correct is B)
];

console.log("Testing ObjectId mapping logic...\n");

let score = 0;
for (const answer of testAnswers) {
  if (answer.questionId !== undefined && answer.selectedAnswer) {
    // If questionId is a MongoDB ObjectId string, find matching question by _id
    if (
      typeof answer.questionId === "string" &&
      answer.questionId.length === 24
    ) {
      const questionIndex = testQuestions.findIndex(
        (q) => q._id && q._id.toString() === answer.questionId,
      );
      if (questionIndex >= 0) {
        const question = testQuestions[questionIndex];
        const isCorrect = question.correctAnswer === answer.selectedAnswer;
        if (isCorrect) {
          score++;
          console.log(
            `✓ Question ${questionIndex}: ${answer.selectedAnswer} is CORRECT`,
          );
        } else {
          console.log(
            `✗ Question ${questionIndex}: ${answer.selectedAnswer} is WRONG (correct: ${question.correctAnswer})`,
          );
        }
      }
    }
  }
}

console.log(`\nFinal Score: ${score}/3`);
console.log(`Expected: 2/3 (first two correct, last wrong)`);

if (score === 2) {
  console.log(`✅ ObjectId mapping logic works correctly!`);
} else {
  console.log(`❌ ObjectId mapping logic failed!`);
}
