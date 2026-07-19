# Getting Started Guide

Welcome to the Aarogya Clinic AI Receptionist project! This guide will help you set up your development environment, understand the project structure, and start contributing effectively.

## 🎯 What This Project Does

The Aarogya Clinic AI Receptionist is a bilingual (English + Hindi) voice AI system that handles clinic appointments over the phone. It consists of:

- **Backend**: FastAPI server with PostgreSQL database, Cliniko PMS integration, and Bolna voice platform integration
- **Frontend**: React dashboard for monitoring and managing clinic operations
- **AI Agent**: Bilingual voice agent that handles phone calls using Bolna platform

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required Software
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **Python** (v3.9 or higher) - [Download](https://www.python.org/downloads/)
- **Git** - [Download](https://git-scm.com/downloads)
- **PostgreSQL client** (optional, for direct DB access) - [Download](https://www.postgresql.org/download/)
- **ngrok** (optional, for local tunneling) - [Download](https://ngrok.com/download)

### Required Accounts
- **Supabase** account (free tier works) - [Sign up](https://supabase.com/)
- **Cliniko** account (trial account works) - [Sign up](https://www.cliniko.com/)
- **Bolna** account (trial account works) - [Sign up](https://bolna.ai/)
- **Twilio** account (trial account works) - [Sign up](https://www.twilio.com/)

### Optional but Recommended
- **VS Code** with recommended extensions

## 🚀 Quick Setup (15 minutes)

### 1. Clone the Repository

```bash
git clone <repository-url>
cd agent-script---after-bolna
```

### 2. Backend Setup

```bash
cd backend

# Create virtual environment (recommended)
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your credentials (see Configuration section below)

# Setup database
python -m db.apply                   # Apply Supabase migrations
python -m seed.seed_cliniko --apply  # Seed Cliniko with clinic data
python -m db.seed_supabase           # Mirror clinic data to Supabase

# Start backend server
python run.py
```

The backend will start on `http://localhost:8080`

### 3. Frontend Setup

```bash
# Open new terminal
cd frontend

# Install dependencies
npm install

# Configure environment (optional for local dev)
cp .env.example .env
# Leave VITE_API_BASE_URL unset for local development

# Start frontend dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 4. Verify Installation

1. Open `http://localhost:5173` in your browser
2. You should see the Aarogya Clinic Dashboard
3. Check that API calls are working (no console errors)
4. Navigate to different sections to verify functionality

## 🔧 Configuration

### Backend Environment Variables

Edit `backend/.env` with your credentials:

```bash
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Cliniko PMS
CLINIKO_API_KEY=your_cliniko_api_key
CLINIKO_BASE_URL=https://api.au5.cliniko.com/v1

# Bolna Voice Platform
BOLNA_API_KEY=your_bolna_api_key
BOLNA_AGENT_ID=your_agent_id
BASE_URL=https://your-backend-url.com  # Use ngrok for local dev

# Tool Authentication
TOOL_WEBHOOK_SECRET=your_random_secret_key

# CORS (for split deployment)
ALLOWED_ORIGINS=http://localhost:5173,https://your-frontend.vercel.app

# Optional: Testing
PMS_FAIL_MODE=0  # Set to 1 to test PMS failure path
```

### Frontend Environment Variables

Edit `frontend/.env` (only needed for split deployment):

```bash
# Only needed when frontend is deployed separately from backend
VITE_API_BASE_URL=https://your-backend-url.com
```

For local development, leave this unset - Vite will proxy to `localhost:8080`.

## 🏗️ Project Structure

```
agent-script---after-bolna/
├── backend/                    # FastAPI backend
│   ├── app/                   # Application code
│   │   ├── main.py           # FastAPI app and routes
│   │   ├── tools.py          # Tool implementations
│   │   ├── availability.py   # Availability engine
│   │   ├── pms_writeback.py  # Cliniko integration
│   │   ├── cliniko_sync.py   # Background sync worker
│   │   └── outbound.py       # Outbound call orchestration
│   ├── db/                    # Database migrations and seeds
│   ├── bolna/                 # Bolna agent configuration
│   │   ├── system_prompt.md  # AI agent system prompt
│   │   ├── tools.json        # Tool definitions
│   │   └── SETUP.md          # Bolna setup guide
│   ├── knowledge/             # Static knowledge base files
│   ├── eval/                  # Evaluation harness
│   ├── seed/                  # Data seeding scripts
│   ├── requirements.txt      # Python dependencies
│   ├── run.py                # Main launcher script
│   └── Procfile              # Process definitions for deployment
├── frontend/                   # React dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── App.tsx       # Main app component
│   │   │   ├── api.ts        # API client
│   │   │   ├── components/   # React components
│   │   │   └── utils/        # Utility functions
│   │   ├── main.tsx          # Entry point
│   │   └── styles/           # Global styles
│   ├── package.json          # Node dependencies
│   └── vite.config.ts        # Vite configuration
├── README.md                  # Main project documentation
├── BUILD_PLAN.md             # Architecture and design decisions
└── docs/                     # Additional documentation
    └── GETTING_STARTED.md    # This file
```

## 🎓 Understanding the System

### Architecture Overview

```
Caller → Phone → Bolna (Voice Platform) → FastAPI Backend → Supabase DB
                                          ↘ Cliniko PMS
Dashboard → React Frontend → FastAPI Backend → Supabase DB
```

### Key Components

1. **Bolna Voice Platform**
   - Handles phone calls, speech-to-text, LLM processing, text-to-speech
   - Executes tool calls to backend during conversations
   - Manages call state and interruptions
   - Supports bilingual (English/Hindi/Hinglish) conversations

2. **FastAPI Backend**
   - Exposes tool endpoints for Bolna agent
   - Implements business logic (booking, availability, patient management)
   - Syncs data between Supabase and Cliniko
   - Runs background workers for sync and outbound calls
   - Provides API endpoints for React dashboard

3. **Supabase Database**
   - Primary data store for appointments, patients, doctors
   - Handles availability calculations
   - Enforces double-booking prevention via database constraints
   - Stores call session state for dropped call recovery

4. **Cliniko PMS**
   - System of record for clinic operations
   - Target for write-back of confirmed bookings
   - Source for master clinic data (branches, doctors, appointment types)
   - Bidirectional sync with Supabase

5. **React Dashboard**
   - Operations interface for clinic staff
   - Real-time monitoring of calls and appointments
   - Patient and appointment management
   - Calendar view with Cliniko-style interface

## 💻 Development Workflow

### Making Backend Changes

1. **Edit code** in `backend/app/`
2. **Restart server**: `Ctrl+C` then `python run.py`
3. **Test changes** via dashboard or API calls
4. **Run eval harness**: `python -m eval.run_eval`

### Making Frontend Changes

1. **Edit code** in `frontend/src/`
2. **Vite hot-reloads** automatically
3. **Test changes** in browser at `http://localhost:5173`
4. **Build for production**: `npm run build`

### Database Changes

1. **Create migration** in `backend/db/migrations/`
2. **Apply migration**: `python -m db.apply`
3. **Update seed scripts** if needed
4. **Test with fresh data**: Re-run seed scripts

### Adding New Tools

1. **Define tool** in `backend/bolna/tools.json`
2. **Implement endpoint** in `backend/app/main.py`
3. **Add logic** in `backend/app/tools.py`
4. **Update system prompt** in `backend/bolna/system_prompt.md`
5. **Rebuild agent config**: `python -m bolna.build_agent_tools`

## 🧪 Testing

### Backend Testing

```bash
# Run evaluation harness
cd backend
python -m eval.run_eval

# Run unit tests (if available)
pytest

# Test specific tool
curl -X POST http://localhost:8080/tools/identify_caller \
  -H "X-Tool-Secret: your-secret" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+919876543210"}'
```

### Frontend Testing

```bash
# Manual testing in browser
npm run dev

# Build test
npm run build
npm run preview
```

### Integration Testing

1. **Test voice agent** via Bolna dashboard with test calls
2. **Verify dashboard** shows call data correctly
3. **Check sync** between Supabase and Cliniko
4. **Test outbound calls** with retry logic

## 🐛 Common Issues and Solutions

### Backend Issues

**"ModuleNotFoundError"**
```bash
# Ensure you're in the backend directory
cd backend
# Activate virtual environment
source venv/bin/activate  # Windows: venv\Scripts\activate
# Reinstall dependencies
pip install -r requirements.txt
```

**"Database connection failed"**
- Check `DATABASE_URL` in `.env`
- Verify Supabase project is active
- Ensure network connectivity

**"Cliniko API error"**
- Verify `CLINIKO_API_KEY` is correct
- Check Cliniko account status
- Ensure API permissions are set

### Frontend Issues

**"API calls failing"**
- Ensure backend is running on port 8080
- Check CORS configuration in backend
- Verify `VITE_API_BASE_URL` if using split deployment

**"Build errors"**
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version (18+)
- Verify TypeScript configuration

### Integration Issues

**"Bolna agent not calling tools"**
- Verify tool configuration in Bolna dashboard
- Check `BASE_URL` is accessible
- Ensure `TOOL_WEBHOOK_SECRET` matches

**"Sync not working"**
- Check background workers are running
- Verify Cliniko API credentials
- Review worker logs for errors

## 📚 Learning Resources

### For Backend Development
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [Cliniko API Documentation](https://www.cliniko.com/api/)

### For Frontend Development
- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)

### For AI/ML Integration
- [Bolna Documentation](https://docs.bolna.ai/)
- [System Prompt Design Guide](../backend/bolna/system_prompt.md)

## 🤝 Contributing

### Code Style Guidelines

**Backend (Python)**
- Follow PEP 8 style guide
- Use type hints where appropriate
- Write docstrings for functions
- Keep functions focused and small

**Frontend (TypeScript/React)**
- Use TypeScript for all components
- Follow React best practices
- Use functional components with hooks
- Keep components small and reusable

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(backend): add rescheduling fee calculation
fix(frontend): resolve calendar display issue on mobile
docs(readme): update deployment instructions
```

### Pull Request Process

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and commit
4. Push to fork: `git push origin feature/my-feature`
5. Create pull request with description
6. Address review feedback
7. Merge when approved

## 🎯 Next Steps

Now that you're set up, here's what you can do:

1. **Explore the codebase** - Read through the main files to understand structure
2. **Run the eval harness** - See how the AI agent performs
3. **Make a small change** - Try adding a new feature or fixing a bug
4. **Read the documentation** - Check out README.md and BUILD_PLAN.md
5. **Join the community** - Contribute and collaborate with others

## 📞 Getting Help

If you run into issues:

1. Check the [Troubleshooting](#-common-issues-and-solutions) section
2. Review the main [README.md](../README.md)
3. Check [BUILD_PLAN.md](../BUILD_PLAN.md) for architecture decisions
4. Search existing GitHub issues
5. Create a new issue with detailed information

---

Happy coding! 🎉
