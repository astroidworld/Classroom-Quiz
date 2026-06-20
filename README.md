# Classroom Quiz - Live Quiz Platform

A production-quality live real-time quiz competition platform for classrooms.

---

## Technical Stack
- **Frontend**: React + Vite + TypeScript + Tailwind CSS + Zustand
- **Backend**: Node.js + Express + TypeScript + Socket.IO + tsx
- **Database**: PostgreSQL + Prisma ORM

---

## Database & Local Run Setup

1. **Docker**: Start the PostgreSQL database container:
   ```bash
   npm run db:up
   ```

2. **Install**: Install dependencies:
   ```bash
   npm install
   ```

3. **Migrations**: Apply Prisma migrations to PostgreSQL:
   ```bash
   npm run prisma:migrate
   ```

4. **Seed**: Seed with default quiz data:
   ```bash
   npm run prisma:seed
   ```

5. **Start Dev Servers**:
   - Backend API: `npm run dev:server` (Port 5000)
   - Frontend Client: `npm run dev:client` (Port 5173)

---

## Import Formats (Phase 2)

### 1. CSV Importer Format

CSV uploads must match the following headers exactly (case-sensitive):

```csv
question,option_a,option_b,option_c,option_d,correct_option,time_limit,points
```

#### Fields Details:
* **`question`** (Required): The text of the question.
* **`option_a`** (Required): The text for Option A.
* **`option_b`** (Required): The text for Option B.
* **`option_c`** (Optional for True/False, Required for MCQ): Option C.
* **`option_d`** (Optional for True/False, Required for MCQ): Option D.
* **`correct_option`** (Required): The letter of the correct answer. Must be one of: `A`, `B`, `C`, or `D` (case-insensitive).
* **`time_limit`** (Optional): Integer overrides representing answer timer length in seconds.
* **`points`** (Optional): Point weighting for the question (defaults to 1000).

#### Example CSV Content:
```csv
question,option_a,option_b,option_c,option_d,correct_option,time_limit,points
Which HTML tag is used for the largest heading?,<h1>,<h6>,<head>,<heading>,A,20,1000
CSS stands for Cascading Style Sheets.,True,False,,,A,15,800
Which property is used to change background color?,color,background-color,bgcolor,background,B,,1000
```

---

### 2. Bulk-Paste Importer Format

Plain text block parsed by line breaks. Format rules:
1. One blank line separates individual questions.
2. The first line of each block is the question text.
3. Subsequent lines represent choices, prefixed by a letter and closing parenthesis `A)`, `B)`, `C)`, `D)`.
4. The correct choice is marked with an asterisk `*` prefix.

#### Example Paste Text:
```text
What character is used to select an ID element in CSS?
A) . (dot)
*B) # (hash)
C) * (asterisk)
D) @ (at)

A <div> element is inline by default.
A) True
*B) False

Which tag is used to create a hyperlink?
*A) <a>
B) <link>
C) <href>
D) <anchor>
```

---

## 3. Advanced Features (Phase 6)

### 3.1 Async / Homework Mode
* **Host Control**: Create homework assignments by selecting a start and end datetime window.
* **Self-Paced Play**: Students join with the code and progress through questions at their own pace.
* **Server-Side Timing**: Accuracy, scoring, and response times are securely calculated on the server using timestamps.
* **End-of-Quiz Review**: Let students review question answers and explanations immediately after submission or after the session ends.

### 3.2 CSV & PDF Reports
* **CSV Export**: Full raw logs of every student response (timestamp, selected option, correctness, duration, points).
* **PDF Summary Report**: A clean, ready-to-print PDF layout containing:
  - Cover page with session info and aggregate metrics.
  - Final scoreboard and podium standings.
  - Question-by-question response details and choice distributions.
  - Individual student scorecard drilldowns.

### 3.3 Visual & Performance Polish
* **QR Codes**: Render join codes as QR codes inside the live session lobby.
* **Podium Confetti**: Canvas-confetti effects when displaying podium finishes or host session completion screen.
* **Rate Limiting**: Security controls on auth routes, session creation, and student joining.

---

## 4. Production Deployment (Coolify / VPS)

This project is configured to run in Docker and can be easily deployed via Coolify or directly on a VPS.

### 4.1 Prerequisites
- Docker & Docker Compose installed on VPS.
- Domain name pointed to VPS.

### 4.2 Local Production Run
To build and test the production bundle locally:
```bash
# Start Docker containers (PostgreSQL database)
npm run db:up

# Build production app container
docker-compose build

# Run the full setup (App & DB)
docker-compose up
```

### 4.3 Environment Variables
Set the following environment variables on your Coolify application instance:
- `NODE_ENV`: `production`
- `DATABASE_URL`: `postgresql://postgres:postgres_password@db:5432/classroom_quiz?schema=public` (Coolify will inject the database connection details)
- `JWT_SECRET`: A secure random secret string
- `JWT_EXPIRES_IN`: `7d`
- `CORS_ORIGIN`: Your production domains (e.g., `https://quiz.example.com`)
- `PORT`: `5000`

```
