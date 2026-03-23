# Online Examination System

Full-stack real-time online examination website with:
- Admin: login, question bank (add/edit/delete), create exams with timer, view results, download CSV reports.
- Student: register, login, view available exams, start exam, answer questions, submit, view results.
- Features: authentication, question bank, exam creation, timer, auto-submission, result calculation.
- Question types: MCQ, passage-based, true/false, match-the-following.

## Tech Stack
- Frontend: React (Vite)
- Backend: Node.js + Express + Socket.IO
- Storage: JSON file (`backend/data.json`) for easy setup

## Project Structure
- `frontend/`
- `backend/`

## Run Backend
```bash
cd backend
npm install
npm run dev
```

Backend URL: `http://localhost:5000`

Default admin credentials:
- Email: `admin@exam.com`
- Password: `admin123`

## Run Frontend
```bash
cd frontend
npm install
npm run dev
```

Frontend URL: `http://localhost:5173`

## Main APIs
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET/POST/PUT/DELETE /api/admin/questions`
- `GET/POST/PUT /api/admin/exams`
- `GET /api/admin/results`
- `GET /api/admin/reports/:examId`
- `GET /api/student/exams`
- `POST /api/student/exams/:examId/start`
- `GET /api/student/attempts/:attemptId`
- `PATCH /api/student/attempts/:attemptId/answers`
- `POST /api/student/attempts/:attemptId/submit`
- `GET /api/student/results`

## Real-Time Behavior
- `Socket.IO` emits `result:submitted` when any attempt is submitted.
- Admin dashboard listens and shows live submissions.
- Server auto-submits expired in-progress attempts every 5 seconds.
