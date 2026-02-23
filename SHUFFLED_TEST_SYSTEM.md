# Shuffled Test System - Anti-Fraud Implementation

## Overview

The backend now implements **server-side question shuffling** to prevent cheating while maintaining accurate scoring. Each user receives questions in a different order, making it nearly impossible to share answers.

## How It Works

### 1. Question Retrieval (`GET /api/tests/:id/questions`)

**New Response Format:**

```json
{
  "success": true,
  "testTitle": "Sample Test",
  "isShuffled": true,
  "questions": [
    {
      "questionId": 2, // Original question index (used for scoring)
      "displayIndex": 0, // Position in shuffled array
      "question": "What is 2+2?",
      "options": {
        "A": "3",
        "B": "4",
        "C": "5",
        "D": "6"
      }
    },
    {
      "questionId": 0, // Original question index
      "displayIndex": 1, // Position in shuffled array
      "question": "What is the capital of France?",
      "options": {
        "A": "London",
        "B": "Berlin",
        "C": "Paris",
        "D": "Madrid"
      }
    }
  ]
}
```

### 2. Answer Submission (`POST /api/tests/:id/submit`)

**Required Answer Format:**

```json
{
  "studentEmail": "student@example.com",
  "studentName": "John Doe",
  "answers": [
    {
      "questionId": 2, // MUST use the questionId from the response
      "selectedAnswer": "B" // User's selected option
    },
    {
      "questionId": 0, // MUST use the questionId from the response
      "selectedAnswer": "C" // User's selected option
    }
  ]
}
```

## Frontend Implementation Guide

### 1. Fetch Questions (No Frontend Shuffling Needed)

```javascript
// DON'T shuffle on frontend - questions come pre-shuffled from server
const response = await fetch("/api/tests/123/questions", {
  headers: { Authorization: `Bearer ${token}` },
});
const { questions } = await response.json();

// Display questions in the order received from server
questions.forEach((q, index) => {
  displayQuestion(q.question, q.options, q.questionId, index);
});
```

### 2. Submit Answers (Use questionId for mapping)

```javascript
// Collect answers using questionId (not display position)
const answers = [];

questions.forEach((question) => {
  const userSelection = getUserAnswer(question.questionId); // Your method to get user's choice

  answers.push({
    questionId: question.questionId, // Critical: use questionId, not array index
    selectedAnswer: userSelection, // "A", "B", "C", or "D"
  });
});

// Submit to backend
await fetch(`/api/tests/123/submit`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    studentEmail: "student@example.com",
    studentName: "John Doe",
    answers: answers,
  }),
});
```

## Key Benefits

### ✅ **Fraud Prevention**

- Each user gets questions in different order
- Sharing question numbers becomes useless
- Deterministic shuffling ensures consistent order per user

### ✅ **Accurate Scoring**

- Server maintains question mapping internally
- Backend scores against original question indices
- No frontend shuffling = no scoring errors

### ✅ **User Experience**

- Same user gets same question order on refresh
- Questions load faster (no client-side processing)
- Immediate feedback on submission

## Technical Details

### Question Mapping Storage

- Stored in Redis (with memory fallback)
- Expires after 2 hours (longer than test duration)
- Cleaned up automatically after test submission

### Deterministic Shuffling Algorithm

- Uses user ID + test ID as seed
- Fisher-Yates shuffle with seeded random
- Same user-test combination = same question order
- Different users = different question orders

## Migration from Frontend Shuffling

### Old Frontend Code (Remove This):

```javascript
// ❌ DON'T DO THIS ANYMORE
const shuffled = questions.sort(() => Math.random() - 0.5);
```

### New Frontend Code:

```javascript
// ✅ DO THIS INSTEAD
// Just display questions in server-provided order
const questionsToDisplay = questions; // Already shuffled by server
```

## Testing the Implementation

### 1. Test Different Users Get Different Orders

```bash
# User 1
curl -H "Authorization: Bearer user1_token" /api/tests/123/questions

# User 2
curl -H "Authorization: Bearer user2_token" /api/tests/123/questions

# Should return different question orders
```

### 2. Test Same User Gets Consistent Order

```bash
# First request
curl -H "Authorization: Bearer user1_token" /api/tests/123/questions

# Second request (should be identical)
curl -H "Authorization: Bearer user1_token" /api/tests/123/questions
```

### 3. Test Accurate Scoring

```bash
# Submit answers using questionId values
curl -X POST /api/tests/123/submit \
  -H "Authorization: Bearer token" \
  -H "Content-Type: application/json" \
  -d '{"answers": [{"questionId": 2, "selectedAnswer": "B"}]}'

# Should return correct score based on original question order
```

## Error Handling

The system includes validation for:

- Missing questionId in answers
- Invalid answer format
- Missing authentication
- Question mapping cleanup failures (graceful degradation)

With this implementation, your test system now prevents fraud through question shuffling while ensuring 100% accurate scoring.
