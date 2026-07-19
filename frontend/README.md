# Aarogya Clinic Dashboard - Frontend

A modern, React-based operations dashboard for the Aarogya Multi-Speciality Clinic voice AI receptionist system. This dashboard provides real-time monitoring and management of clinic appointments, patients, calls, and system health.

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 📋 Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Environment Configuration](#environment-configuration)
- [Development Guide](#development-guide)
- [API Integration](#api-integration)
- [Component Library](#component-library)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## 🎯 Overview

The Aarogya Clinic Dashboard is a single-page React application that serves as the operations interface for clinic staff. It connects to the FastAPI backend to provide:

- **Real-time appointment management** - View, search, and manage clinic appointments
- **Call monitoring** - Live view of inbound/outbound calls with transcripts
- **Patient management** - Patient registry with contact information and history
- **Calendar view** - Visual appointment scheduling grid
- **System health** - Backend service status and connection monitoring
- **Follow-up tracking** - Escalation and callback management

The dashboard is designed to be deployed separately from the backend (e.g., Vercel for frontend, Render/Railway for backend) or served by the backend itself for single-host deployments.

## 🛠 Tech Stack

### Core Framework
- **React 18.3.1** - UI framework with hooks and concurrent features
- **TypeScript 5.7.3** - Type-safe development
- **Vite 6.3.5** - Fast build tool and dev server

### UI Components & Styling
- **Radix UI** - Headless, accessible component primitives
  - Dialogs, dropdowns, navigation, forms, and more
- **Material UI (@mui/material)** - Additional UI components and icons
- **Tailwind CSS 4.1.12** - Utility-first CSS framework
- **Lucide React** - Beautiful, consistent icon set
- **Framer Motion** - Smooth animations and transitions

### Data & State Management
- **React Router 7.13.0** - Client-side routing
- **React Hook Form 7.55.0** - Form state management
- **date-fns 3.6.0** - Date manipulation and formatting
- **Recharts 2.15.2** - Data visualization and charts

### Specialized Components
- **react-day-picker 8.10.1** - Calendar date picker
- **react-dnd 16.0.1** - Drag and drop functionality
- **embla-carousel-react 8.6.0** - Carousel/slider components
- **cmdk 1.1.1** - Command palette functionality

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── App.tsx              # Main application component
│   │   ├── api.ts               # API client and backend integration
│   │   ├── components/          # Reusable UI components
│   │   │   ├── ui/              # Base UI components (buttons, inputs, etc.)
│   │   │   ├── dashboard/       # Dashboard-specific components
│   │   │   ├── appointments/    # Appointment management components
│   │   │   ├── patients/        # Patient management components
│   │   │   └── calls/           # Call monitoring components
│   │   └── utils/               # Utility functions and helpers
│   ├── main.tsx                 # Application entry point
│   └── styles/                 # Global styles and Tailwind configuration
├── public/                      # Static assets
├── index.html                   # HTML template
├── package.json                 # Dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.ts               # Vite build configuration
├── tailwind.config.js           # Tailwind CSS configuration
├── vercel.json                  # Vercel deployment configuration
└── .env.example                 # Environment variables template
```

## ✨ Features

### Dashboard Views

1. **Overview**
   - KPI statistics (total appointments, active patients, call metrics)
   - Live availability finder
   - System health status (Cliniko + Bolna connections)
   - Quick action buttons

2. **Inbound Calls**
   - Real-time call session list
   - Transcript viewer with search
   - Dropped call handling with "Schedule callback" action
   - Call session state management

3. **Calendar**
   - Cliniko-style day grid view
   - Doctors displayed as columns
   - Appointments as time-positioned blocks
   - Color-coded by origin (Agent vs. Cliniko)
   - Drag-and-drop rescheduling

4. **Appointments**
   - Comprehensive appointment list
   - Status filtering (booked, cancelled, completed)
   - PMS sync state indicators
   - Origin tracking (Agent/Cliniko manual)
   - Bulk operations

5. **Patients**
   - Patient registry with search
   - Contact information management
   - Cliniko link status
   - Appointment history per patient

6. **Outbound Calls**
   - Call queue management
   - Retry policy controls
   - Continuation context handling
   - Call status tracking

7. **Follow-ups**
   - Escalation tracking
   - Out-of-scope issue management
   - "Mark resolved" actions
   - Priority categorization

8. **Call Sessions**
   - Raw session state debugging
   - Bidirectional context viewing
   - State transition tracking

9. **Clinic Setup**
   - Branch management
   - Doctor/practitioner configuration
   - Appointment type settings
   - Supabase ↔ Cliniko link status

## 🔧 Environment Configuration

### Required Environment Variables

```bash
# API Base URL (Required for split deployment)
# The public URL of the deployed backend (Render/Railway/etc.)
# Only needed when dashboard is deployed separately from backend
VITE_API_BASE_URL=https://your-backend.up.railway.app
```

### Local Development

For local development, you can leave `VITE_API_BASE_URL` unset. Vite's dev server will proxy API calls to the backend running on `http://localhost:8080` (configured in `vite.config.ts`).

### Deployment

When deploying to production (e.g., Vercel), set `VITE_API_BASE_URL` to your backend's deployed URL. This variable is baked into the build at compile time.

## 💻 Development Guide

### Prerequisites

- Node.js 18+ and npm
- Backend server running (see main README.md)
- (Optional) Supabase and Cliniko accounts for full functionality

### Setting Up Development Environment

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd agent-script---after-bolna/frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env if deploying separately from backend
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```
   The dashboard will be available at `http://localhost:5173`

5. **Start backend** (in a separate terminal)
   ```bash
   cd ../backend
   python run.py
   ```

### Code Style & Conventions

- **TypeScript**: All components use TypeScript for type safety
- **Component organization**: Components are organized by feature/domain
- **Naming conventions**: 
  - Components: PascalCase (`AppointmentCard.tsx`)
  - Utilities: camelCase (`formatDate.ts`)
  - Constants: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Import order**: React imports → Third-party imports → Local imports

### Adding New Components

1. Create component file in appropriate directory:
   ```bash
   touch src/app/components/dashboard/NewComponent.tsx
   ```

2. Follow the component template:
   ```typescript
   import React from 'react';
   
   interface NewComponentProps {
     // Define props interface
   }
   
   export const NewComponent: React.FC<NewComponentProps> = ({ prop }) => {
     return (
       <div>
         {/* Component JSX */}
       </div>
     );
   };
   ```

3. Export from index file if needed for barrel imports

### Testing

Currently, the frontend does not have automated tests. Manual testing is performed by:

1. Running the development server
2. Navigating to different dashboard views
3. Testing API integrations with backend
4. Verifying responsive design on different screen sizes

## 🔌 API Integration

The dashboard communicates with the FastAPI backend through a centralized API client (`src/app/api.ts`).

### API Client Configuration

```typescript
// Base URL is read from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';
```

### Common API Patterns

#### GET Requests
```typescript
const fetchAppointments = async () => {
  const response = await fetch(`${API_BASE_URL}/api/appointments`);
  if (!response.ok) throw new Error('Failed to fetch appointments');
  return response.json();
};
```

#### POST Requests
```typescript
const createAppointment = async (data: AppointmentData) => {
  const response = await fetch(`${API_BASE_URL}/api/appointments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('Failed to create appointment');
  return response.json();
};
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/appointments` | GET | List all appointments |
| `/api/appointments/:id` | GET | Get specific appointment |
| `/api/patients` | GET | List all patients |
| `/api/calls` | GET | List call sessions |
| `/api/calls/:id/transcript` | GET | Get call transcript |
| `/api/availability` | GET | Check availability |
| `/api/followups` | GET | List follow-ups |
| `/api/followups/:id/resolve` | POST | Mark follow-up as resolved |
| `/api/outbound/enqueue` | POST | Enqueue outbound call |
| `/api/health` | GET | System health check |

### Error Handling

All API calls include basic error handling. Errors are logged to the console and can be displayed to users through toast notifications (using the `sonner` library).

## 🎨 Component Library

### Base UI Components (`src/app/components/ui/`)

The project uses a set of base UI components built on Radix UI and Tailwind CSS:

- **Button** - Various button styles and sizes
- **Input** - Text input with validation states
- **Select** - Dropdown select component
- **Dialog** - Modal dialogs
- **Dropdown Menu** - Context menus
- **Tabs** - Tabbed navigation
- **Card** - Content containers
- **Badge** - Status indicators
- **Table** - Data tables with sorting
- **Tooltip** - Hover tooltips

### Feature Components

#### Dashboard Components
- `KPICard` - Key performance indicator display
- `StatusIndicator` - System status visualization
- `QuickActions` - Common action buttons

#### Appointment Components
- `AppointmentCard` - Single appointment display
- `AppointmentList` - List view with filters
- `AppointmentForm` - Create/edit form
- `CalendarGrid` - Calendar view component

#### Patient Components
- `PatientCard` - Patient information display
- `PatientSearch` - Search and filter patients
- `PatientForm` - Patient registration form

#### Call Components
- `CallSessionCard` - Call session display
- `TranscriptViewer` - Call transcript display
- `CallStatusBadge` - Status indicator

### Using Components

```typescript
import { Button } from '@/app/components/ui/button';
import { Card } from '@/app/components/ui/card';

export const MyComponent = () => {
  return (
    <Card>
      <Button variant="default">Click me</Button>
    </Card>
  );
};
```

## 🚀 Deployment

### Vercel (Recommended)

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel
   ```

3. **Configure environment variables**
   - Set `VITE_API_BASE_URL` to your backend URL
   - Other variables as needed

4. **Deploy to production**
   ```bash
   vercel --prod
   ```

### Netlify

1. **Build settings**
   - Build command: `npm run build`
   - Publish directory: `dist`

2. **Environment variables**
   - Add `VITE_API_BASE_URL` in Netlify dashboard

### Static Hosting

For any static hosting provider:

1. **Build the project**
   ```bash
   npm run build
   ```

2. **Upload `dist/` folder** to your hosting provider

3. **Configure environment variables** if supported

### Single-Host Deployment

For local development or simple deployments, the backend can serve the frontend:

1. **Build frontend**
   ```bash
   npm run build
   ```

2. **Backend will automatically serve** the built frontend from `frontend/dist/`

## 🔍 Troubleshooting

### Common Issues

#### "API calls failing with 404"
- **Cause**: `VITE_API_BASE_URL` not set correctly for split deployment
- **Solution**: Ensure the environment variable is set to the correct backend URL and rebuild

#### "CORS errors in browser console"
- **Cause**: Backend CORS configuration doesn't allow frontend origin
- **Solution**: Add frontend URL to backend's `ALLOWED_ORIGINS` environment variable

#### "Styles not loading correctly"
- **Cause**: Tailwind CSS not properly configured
- **Solution**: Ensure `tailwind.config.js` is correct and styles are imported in `main.tsx`

#### "TypeScript errors after dependency update"
- **Cause**: Type definitions mismatch
- **Solution**: Run `npm install --force` to reinstall dependencies

#### "Build fails with out of memory"
- **Cause**: Node.js memory limit during build
- **Solution**: Increase Node.js memory limit: `NODE_OPTIONS="--max-old-space-size=4096" npm run build`

### Development Issues

#### "Hot module replacement not working"
- **Cause**: Vite dev server issue
- **Solution**: Restart dev server and clear browser cache

#### "Port 5173 already in use"
- **Cause**: Another process using the port
- **Solution**: Kill the process or use different port: `npm run dev -- --port 3000`

### Getting Help

- Check the main [README.md](../README.md) for backend-related issues
- Review [BUILD_PLAN.md](../BUILD_PLAN.md) for architectural decisions
- Check component documentation in source files for usage examples

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)
- [Material UI Documentation](https://mui.com/material-ui/)

## 🤝 Contributing

When contributing to the frontend:

1. Follow existing code style and conventions
2. Add TypeScript types for all props and state
3. Use existing UI components when possible
4. Test responsive design on different screen sizes
5. Update documentation for new features
6. Ensure API integration follows existing patterns

## 📄 License

This project is part of the Aarogya Clinic AI Receptionist system. See main project LICENSE for details.
