# Huroof Game API Documentation

## Authentication
All admin endpoints require Basic Authentication with:
- Username: `admin`
- Password: `admin`
- Header: `Authorization: Basic YWRtaW46YWRtaW4=`

## Question Management API

### Database-backed Endpoints (Recommended)

#### Get All Questions
```
GET /api/admin/db/questions
```
Returns all questions from the database with pagination support.

#### Get Question by ID
```
GET /api/admin/db/questions/{id}
```
Returns a specific question from the database.

#### Create New Question
```
POST /api/admin/db/questions
Content-Type: application/json

{
  "letter": "أ",
  "question": "ما اسم أول إنسان خُلق؟",
  "answer": "آدم",
  "category": "دين",
  "difficulty": "easy"
}
```

#### Update Question
```
PUT /api/admin/db/questions/{id}
Content-Type: application/json

{
  "letter": "أ",
  "question": "Updated question text",
  "answer": "Updated answer",
  "category": "دين",
  "difficulty": "medium"
}
```

#### Delete Question
```
DELETE /api/admin/db/questions/{id}
```
Deletes a specific question from the database.

#### Bulk Import Questions
```
POST /api/admin/db/questions/import
Content-Type: application/json

[
  {
    "letter": "أ",
    "question": "Question text",
    "answer": "Answer",
    "category": "دين",
    "difficulty": "easy"
  }
]
```

#### Bulk Add Questions (Append)
```
POST /api/admin/db/questions/bulk-add
Content-Type: application/json

[
  {
    "letter": "أ",
    "question": "Question text",
    "answer": "Answer",
    "category": "دين",
    "difficulty": "easy"
  }
]
```
*Adds questions to existing ones, doesn't replace*

#### Get Categories
```
GET /api/admin/db/questions/categories
```
Returns all unique categories from the database.

#### Migrate from JSON to Database
```
POST /api/admin/db/questions/migrate
```
Migrates all questions from the JSON file to the database.
Will fail if database already contains questions.

#### Clear All Questions
```
DELETE /api/admin/db/questions
```
Deletes ALL questions from the database. Use with caution!

### Legacy JSON Endpoints (Still Available)

#### Get All Questions (JSON)
```
GET /api/admin/questions
```

#### Create Question (JSON)
```
POST /api/admin/questions
```

#### Update Question (JSON)
```
PUT /api/admin/questions/{id}
```

#### Delete Question (JSON)
```
DELETE /api/admin/questions/{id}
```

#### Export Questions (JSON)
```
GET /api/admin/questions/export
```
Downloads all questions as a JSON file.

## Public Endpoints (No Authentication Required)

#### Get Questions (Public)
```
GET /api/questions?letter={letter}&category={category}&difficulty={difficulty}&search={search}
```
Returns questions with optional filtering parameters.

#### Get Random Question
```
GET /api/questions/random?letter={letter}
```
Returns a random question for the specified letter.

## Session Management API

#### Get All Sessions
```
GET /api/admin/sessions
```

#### Get Session Details
```
GET /api/admin/sessions/{id}
```

#### Update Session Settings
```
PUT /api/admin/sessions/{id}/settings
Content-Type: application/json

{
  "gridSize": 5,
  "totalRounds": 5
}
```

#### Reset Session
```
POST /api/admin/sessions/{id}/reset
```

#### Start Session
```
POST /api/admin/sessions/{id}/start
Content-Type: application/json

{
  "gridSize": 5,
  "totalRounds": 5,
  "timerFirst": 30,
  "timerSecond": 20
}
```

#### End Session
```
DELETE /api/admin/sessions/{id}
```

## Database Schema

### Questions Table
```sql
CREATE TABLE "Questions" (
    "Id" TEXT NOT NULL PRIMARY KEY,
    "Letter" TEXT NOT NULL,
    "QuestionText" TEXT NOT NULL,
    "Answer" TEXT NOT NULL,
    "Category" TEXT NOT NULL DEFAULT 'عام',
    "Difficulty" TEXT NOT NULL DEFAULT 'medium',
    "CreatedAt" TEXT NOT NULL DEFAULT (datetime('now')),
    "UpdatedAt" TEXT NULL
);
```

## Usage Examples

### Using curl

#### Create a new question:
```bash
curl -X POST http://localhost:5062/api/admin/db/questions \
  -H "Authorization: Basic YWRtaW46YWRtaW4=" \
  -H "Content-Type: application/json" \
  -d '{
    "letter": "ب",
    "question": "ما عاصمة فرنسا؟",
    "answer": "باريس",
    "category": "جغرافيا",
    "difficulty": "easy"
  }'
```

#### Get all questions:
```bash
curl -X GET http://localhost:5062/api/admin/db/questions \
  -H "Authorization: Basic YWRtaW46YWRtaW4="
```

### Migration Steps

1. First, ensure your JSON file has all questions (check `/api/admin/questions`)
2. Click "Migrate from JSON" button in admin panel
3. Or use API: `POST /api/admin/db/questions/migrate`
4. Verify migration worked by checking `/api/admin/db/questions`
5. Once verified, you can continue using database endpoints for all operations

## New Features Added

### 1. Letter Filtering
- Questions can now be filtered by letter in the admin panel
- Dynamic letter dropdown populated from database

### 2. JSON Upload (Additive)
- Upload JSON files with questions to ADD to existing database
- Doesn't replace existing questions
- Supports multiple JSON formats:
  ```json
  [
    {
      "Letter": "أ",
      "Question": "Question text",
      "Answer": "Answer",
      "Category": "دين",
      "Difficulty": "easy"
    }
  ]
  ```
  OR
  ```json
  [
    {
      "letter": "أ",
      "question": "Question text",
      "answer": "Answer",
      "category": "دين",
      "difficulty": "easy"
    }
  ]
  ```

### 3. Clear All Questions
- Admin can delete all questions from database with confirmation
- Useful for starting fresh with a new question set

### 4. Backend-Driven Game
- Game now fetches questions from backend database
- No more client-side question dependency
- All game modes use backend API for random questions

## Benefits of Database Approach

1. **Performance**: Faster queries with indexing
2. **Scalability**: Can handle thousands of questions efficiently
3. **Reliability**: ACID transactions prevent data corruption
4. **Search**: Full-text search capabilities
5. **Backup**: Easy to backup and restore
6. **Concurrent Access**: Multiple admins can work simultaneously
7. **Audit Trail**: CreatedAt and UpdatedAt timestamps
8. **Future Features**: Can add question ratings, usage statistics, etc.
