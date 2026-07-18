# AntiCheatOES_V2 - Online Examination System

A full-stack online examination system with a Python FastAPI backend and React TypeScript frontend.

## Project Structure

```
AntiCheatOES_V2/
├── backend/           # Python FastAPI backend
│   ├── main.py
│   ├── pyproject.toml
│   └── .venv/
├── frontend/          # React TypeScript frontend
│   ├── src/
│   ├── package.json
│   └── vite.config.ts
└── database/          # Database files
```

## Prerequisites

- **Python 3.12+** (for backend)
- **Node.js 18+** (for frontend)
- **npm** or **yarn** (frontend package manager)

## Setup & Running

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies using `uv` (recommended) or pip:
   ```bash
   # Using uv (fast)
   uv sync
   
   # Or using pip
   pip install -r requirements.txt
   ```

3. Run the backend server:
   ```bash
   # Using uv
   uv run python main.py
   
   # Or using Python directly (from .venv)
   python main.py
   ```

   The backend will start at `http://localhost:8000`

4. API Documentation: Visit `http://localhost:8000/docs` for interactive API docs

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.development` file (or it should already exist):
   ```
   VITE_API_URL=http://localhost:8000
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

   The frontend will start at `http://localhost:5173`

## Development Workflow

To run both backend and frontend together, open two terminal windows:

**Terminal 1 (Backend):**
```bash
cd backend
uv run python main.py
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

## API Endpoints

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

## Frontend API Integration

The frontend uses the API client located at `src/services/api.ts`. Example usage:

```typescript
import { authAPI } from '@/services/api';

// Login
const response = await authAPI.login({
  username: 'user',
  password: 'password'
});

// Register
const registerResponse = await authAPI.register({
  username: 'newuser',
  email: 'user@example.com',
  password: 'password',
  role: 'student'
});
```

## Configuration

### Backend
- Port: `8000`
- CORS: Enabled for `http://localhost:5173` and `http://localhost:3000`

### Frontend
- Port: `5173` (Vite default)
- API URL: Configured via `VITE_API_URL` environment variable
- Dev proxy: `/api` endpoints are proxied to backend

## Technologies

### Backend
- FastAPI
- Pydantic (data validation)
- Uvicorn (ASGI server)
- Python 3.12+

### Frontend
- React 18
- TypeScript
- Vite
- TailwindCSS
- Radix UI Components
- React Hook Form

## Next Steps

1. Implement authentication with JWT tokens
2. Set up database (SQLite, PostgreSQL, etc.)
3. Create database models and migrations
4. Implement user registration with proper validation
5. Add role-based access control (RBAC)
6. Create exam-related endpoints
7. Implement anti-cheat measures (frontend and backend)

## Troubleshooting

### Backend not found from frontend
- Make sure backend is running on `http://localhost:8000`
- Check `VITE_API_URL` in `.env.development`
- Check browser console for CORS errors

### Port already in use
- Backend: Change port in `main.py`
- Frontend: Vite will auto-select another port or set `server.port` in `vite.config.ts`

### Dependencies issues
- Backend: Run `uv sync` to install exact versions
- Frontend: Delete `node_modules` and `package-lock.json`, then run `npm install`
