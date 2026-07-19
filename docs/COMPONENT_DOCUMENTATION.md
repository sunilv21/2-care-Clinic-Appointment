# Component Documentation

Complete guide to the React components used in the Aarogya Clinic Dashboard. This documentation covers both base UI components and feature-specific components.

## 📚 Table of Contents

- [Base UI Components](#base-ui-components)
- [Feature Components](#feature-components)
- [Component Patterns](#component-patterns)
- [Styling Guidelines](#styling-guidelines)
- [State Management](#state-management)

## 🎨 Base UI Components

Base UI components are located in `src/app/components/ui/` and provide reusable, accessible building blocks for the application.

### Button

A versatile button component with multiple variants and sizes.

**Location:** `src/app/components/ui/button.tsx`

**Props:**
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'destructive'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}
```

**Usage:**
```typescript
import { Button } from '@/app/components/ui/button';

<Button variant="default" size="default">Click me</Button>
<Button variant="outline" size="sm">Small outline</Button>
<Button variant="destructive">Delete</Button>
```

**Variants:**
- `default`: Primary action button with gradient background
- `outline`: Bordered button for secondary actions
- `ghost`: Minimal button for toolbar actions
- `destructive`: Red button for destructive actions

---

### Card

A container component for grouping related content.

**Location:** `src/app/components/ui/card.tsx`

**Components:**
- `Card`: Main container
- `CardHeader`: Header section with title
- `CardTitle`: Title text
- `CardContent`: Main content area

**Usage:**
```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/app/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Card Title</CardTitle>
  </CardHeader>
  <CardContent>
    <p>Card content goes here</p>
  </CardContent>
</Card>
```

---

### Input

Text input component with validation states.

**Location:** `src/app/components/ui/input.tsx`

**Props:**
```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}
```

**Usage:**
```typescript
import { Input } from '@/app/components/ui/input';

<Input placeholder="Enter name" />
<Input error placeholder="Invalid input" />
```

---

### Select

Dropdown select component for choosing from options.

**Location:** `src/app/components/ui/select.tsx`

**Usage:**
```typescript
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/app/components/ui/select';

<Select>
  <SelectTrigger>
    <SelectValue placeholder="Select option" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Option 1</SelectItem>
    <SelectItem value="option2">Option 2</SelectItem>
  </SelectContent>
</Select>
```

---

### Dialog

Modal dialog component for overlays and popups.

**Location:** `src/app/components/ui/dialog.tsx`

**Components:**
- `Dialog`: Main container
- `DialogTrigger`: Button to open dialog
- `DialogContent`: Dialog content
- `DialogHeader`: Header section
- `DialogTitle`: Title text
- `DialogDescription`: Description text

**Usage:**
```typescript
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';

<Dialog>
  <DialogTrigger asChild>
    <Button>Open Dialog</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Dialog Title</DialogTitle>
    </DialogHeader>
    <p>Dialog content</p>
  </DialogContent>
</Dialog>
```

---

### Badge

Small status indicator component.

**Location:** `src/app/components/ui/badge.tsx`

**Props:**
```typescript
interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}
```

**Usage:**
```typescript
import { Badge } from '@/app/components/ui/badge';

<Badge variant="default">Active</Badge>
<Badge variant="secondary">Pending</Badge>
<Badge variant="destructive">Error</Badge>
```

---

### Table

Data table component with built-in styling.

**Location:** `src/app/components/ui/table.tsx`

**Components:**
- `Table`: Main container
- `TableHeader`: Header section
- `TableRow`: Row component
- `TableHead`: Header cell
- `TableBody`: Body section
- `TableCell`: Data cell

**Usage:**
```typescript
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/app/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Status</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>Active</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### Label

Form label component for accessibility.

**Location:** `src/app/components/ui/label.tsx`

**Usage:**
```typescript
import { Label } from '@/app/components/ui/label';

<Label htmlFor="name">Name</Label>
<Input id="name" />
```

---

### Textarea

Multi-line text input component.

**Location:** `src/app/components/ui/textarea.tsx`

**Usage:**
```typescript
import { Textarea } from '@/app/components/ui/textarea';

<Textarea placeholder="Enter description" rows={4} />
```

---

### Collapsible

Collapsible content component.

**Location:** `src/app/components/ui/collapsible.tsx`

**Usage:**
```typescript
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/app/components/ui/collapsible';

<Collapsible>
  <CollapsibleTrigger>Toggle</CollapsibleTrigger>
  <CollapsibleContent>
    <p>Collapsible content</p>
  </CollapsibleContent>
</Collapsible>
```

---

## 🚀 Feature Components

Feature components are located in `src/app/components/` and implement specific dashboard functionality.

### Dashboard

Main dashboard component showing KPIs and quick actions.

**Location:** `src/app/components/Dashboard.tsx`

**Features:**
- KPI stat cards (Total Leads, Calls Made, Meetings, Success Rate)
- Upcoming meetings list
- Recent activity feed
- Quick action cards
- Auto-refresh every 30 seconds

**Props:**
```typescript
interface DashboardProps {
  onNavigate?: (view: string) => void
}
```

**Usage:**
```typescript
import { Dashboard } from '@/app/components/Dashboard';

<Dashboard onNavigate={(view) => setCurrentView(view)} />
```

**Key Functions:**
- `loadDashboard()`: Fetches dashboard data from API
- Auto-refresh via `useEffect` with 30s interval
- Error handling with retry functionality

---

### Calendar

Cliniko-style calendar grid for appointment visualization.

**Location:** `src/app/components/Calendar.tsx`

**Features:**
- Day view with doctor columns
- Time-based appointment blocks
- Color-coded by origin (Agent vs. Cliniko)
- Date navigation (previous/next/today)
- Responsive grid layout

**Configuration:**
```typescript
const DAY_START = 8 * 60;   // 08:00
const DAY_END = 20 * 60;    // 20:00
const PX_PER_MIN = 0.9;     // Grid density
```

**Usage:**
```typescript
import { Calendar } from '@/app/components/Calendar';

<Calendar />
```

**Key Features:**
- Doctor-specific color coding
- Origin-based styling (Agent = blue, Cliniko = purple)
- Hover tooltips with appointment details
- Empty state handling

---

### InboundCalls

Component for monitoring inbound call sessions.

**Location:** `src/app/components/InboundCalls.tsx`

**Features:**
- List of all inbound call sessions
- Call status indicators
- Transcript viewer integration
- Dropped call handling
- Schedule callback action

**Usage:**
```typescript
import { InboundCalls } from '@/app/components/InboundCalls';

<InboundCalls />
```

---

### CallLogs

Component for viewing call history and logs.

**Location:** `src/app/components/CallLogs.tsx`

**Features:**
- Comprehensive call log listing
- Status filtering
- Search functionality
- Export capabilities
- Performance metrics

**Usage:**
```typescript
import { CallLogs } from '@/app/components/CallLogs';

<CallLogs />
```

---

### Appointments

Appointment management component.

**Location:** `src/app/components/Appointments.tsx`

**Features:**
- Appointment listing
- Status filtering
- Patient information
- Doctor/branch details
- PMS sync status

**Usage:**
```typescript
import { Appointments } from '@/app/components/Appointments';

<Appointments />
```

---

### Patients

Patient management component.

**Location:** `src/app/components/Patients.tsx`

**Features:**
- Patient registry
- Search and filter
- Contact information
- Appointment history
- Cliniko link status

**Usage:**
```typescript
import { Patients } from '@/app/components/Patients';

<Patients />
```

---

### Followups

Follow-up tracking and management component.

**Location:** `src/app/components/Followups.tsx`

**Features:**
- Follow-up request listing
- Resolution tracking
- Priority categorization
- Mark resolved action
- Escalation details

**Usage:**
```typescript
import { Followups } from '@/app/components/Followups';

<Followups />
```

---

### Outbound

Outbound call management component.

**Location:** `src/app/components/Outbound.tsx`

**Features:**
- Outbound call queue
- Retry status
- Call scheduling
- Context management
- Performance tracking

**Usage:**
```typescript
import { Outbound } from '@/app/components/Outbound';

<Outbound />
```

---

### Transcripts

Call transcript viewer component.

**Location:** `src/app/components/Transcripts.tsx`

**Features:**
- Transcript display
- Speaker identification
- Timestamp tracking
- Search functionality
- Export options

**Usage:**
```typescript
import { Transcripts } from '@/app/components/Transcripts';

<Transcripts />
```

---

### Campaigns

Campaign management component for outbound calling.

**Location:** `src/app/components/Campaigns.tsx`

**Features:**
- Campaign listing
- Lead management
- Performance metrics
- Campaign configuration
- Status tracking

**Usage:**
```typescript
import { Campaigns } from '@/app/components/Campaigns';

<Campaigns />
```

---

### Meetings

Meeting scheduling and management component.

**Location:** `src/app/components/Meetings.tsx`

**Features:**
- Meeting calendar
- Scheduling interface
- Participant management
- Status tracking
- Reminder settings

**Usage:**
```typescript
import { Meetings } from '@/app/components/Meetings';

<Meetings />
```

---

### ClinicSetup

Clinic configuration component.

**Location:** `src/app/components/ClinicSetup.tsx`

**Features:**
- Branch management
- Doctor configuration
- Appointment type settings
- Working hours setup
- Supabase ↔ Cliniko link status

**Usage:**
```typescript
import { ClinicSetup } from '@/app/components/ClinicSetup';

<ClinicSetup />
```

---

### Overview

Overview component for high-level system status.

**Location:** `src/app/components/Overview.tsx`

**Features:**
- System health indicators
- Connection status (Cliniko, Bolna)
- Performance metrics
- Quick statistics
- Alert notifications

**Usage:**
```typescript
import { Overview } from '@/app/components/Overview';

<Overview />
```

---

### Settings

Application settings component.

**Location:** `src/app/components/Settings.tsx`

**Features:**
- User preferences
- System configuration
- API settings
- Notification preferences
- Theme options

**Usage:**
```typescript
import { Settings } from '@/app/components/Settings';

<Settings />
```

---

### Sidebar

Navigation sidebar component.

**Location:** `src/app/components/Sidebar.tsx`

**Features:**
- Navigation menu
- Active state indication
- Collapsible sections
- Icon-based navigation
- Responsive design

**Usage:**
```typescript
import { Sidebar } from '@/app/components/Sidebar';

<Sidebar currentView="dashboard" onNavigate={handleNavigate} />
```

---

### UploadAndCall

Lead upload and campaign initiation component.

**Location:** `src/app/components/UploadAndCall.tsx`

**Features:**
- File upload interface
- CSV parsing
- Lead validation
- Campaign creation
- Bulk calling initiation

**Usage:**
```typescript
import { UploadAndCall } from '@/app/components/UploadAndCall';

<UploadAndCall />
```

---

### Leads

Lead management component.

**Location:** `src/app/components/Leads.tsx`

**Features:**
- Lead listing
- Status tracking
- Contact information
- Assignment management
- Conversion tracking

**Usage:**
```typescript
import { Leads } from '@/app/components/Leads';

<Leads />
```

---

### Sessions

Call session debugging component.

**Location:** `src/app/components/Sessions.tsx`

**Features:**
- Raw session state viewing
- Context inspection
- State transition tracking
- Debug information
- Export capabilities

**Usage:**
```typescript
import { Sessions } from '@/app/components/Sessions';

<Sessions />
```

---

## 🧩 Component Patterns

### Loading Pattern

Most components use a consistent loading pattern:

```typescript
const { data, loading, error } = useLoad(() => fetchData(), [dependency]);

return (
  <Card>
    <StateBlock loading={loading} error={error} />
    {data && <ContentDisplay data={data} />}
  </Card>
);
```

### Error Handling Pattern

Components use a unified error handling approach:

```typescript
if (error) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
      <p className="text-red-600">{error}</p>
      <Button variant="outline" size="sm" onClick={retry}>
        <RefreshCw className="size-4" />Retry
      </Button>
    </div>
  );
}
```

### Navigation Pattern

Components use a callback prop for navigation:

```typescript
interface ComponentProps {
  onNavigate?: (view: string) => void;
}

// Usage
<Button onClick={() => onNavigate?.("appointments")}>View Appointments</Button>
```

### Data Fetching Pattern

Components use the centralized API client:

```typescript
import { getAppointments } from '../api';

const loadData = async () => {
  try {
    const { appointments } = await getAppointments();
    setData(appointments);
  } catch (error) {
    setError(error.message);
  }
};
```

---

## 🎨 Styling Guidelines

### Tailwind CSS Usage

The project uses Tailwind CSS for styling with these conventions:

**Spacing:**
- Use `gap-4`, `gap-6` for consistent spacing
- Use `p-4`, `p-6` for padding
- Use `m-4`, `m-6` for margins

**Colors:**
- Primary: `blue-500`, `blue-600`
- Success: `green-500`, `green-600`
- Warning: `yellow-500`, `yellow-600`
- Error: `red-500`, `red-600`
- Neutral: `gray-500`, `gray-600`

**Typography:**
- Headings: `text-lg`, `text-xl`, `font-semibold`
- Body: `text-sm`, `text-base`
- Muted: `text-gray-500`

**Borders:**
- Standard: `border border-gray-200`
- Hover: `hover:border-blue-500`
- Focus: `focus:border-blue-500`

### Responsive Design

Use responsive classes for mobile-first design:

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
  {/* Responsive grid */}
</div>
```

### Gradient Usage

Gradients for visual emphasis:

```typescript
<div className="bg-gradient-to-br from-blue-500 to-blue-600">
  {/* Gradient background */}
</div>
```

---

## 🔄 State Management

### Local State

Components use React hooks for local state:

```typescript
const [data, setData] = useState<any[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
```

### Effects

Use `useEffect` for side effects:

```typescript
useEffect(() => {
  loadData();
}, [dependency]);

// Cleanup
useEffect(() => {
  const interval = setInterval(loadData, 30000);
  return () => clearInterval(interval);
}, [loadData]);
```

### Callbacks

Use `useCallback` for performance:

```typescript
const loadData = useCallback(async () => {
  // Load logic
}, [dependency]);
```

### Custom Hooks

The project uses custom hooks like `useLoad`:

```typescript
const { data, loading, error } = useLoad(() => fetchData(), [dependency]);
```

---

## 📐 Component Architecture

### Component Hierarchy

```
App.tsx
├── Sidebar
├── Main Content Area
│   ├── Dashboard
│   ├── Calendar
│   ├── InboundCalls
│   ├── Appointments
│   ├── Patients
│   ├── Outbound
│   ├── Followups
│   ├── Transcripts
│   ├── Campaigns
│   ├── Meetings
│   ├── ClinicSetup
│   ├── Overview
│   ├── Settings
│   ├── UploadAndCall
│   ├── Leads
│   └── Sessions
└── UI Components (shared)
    ├── Button
    ├── Card
    ├── Input
    ├── Select
    ├── Dialog
    ├── Badge
    ├── Table
    └── ...
```

### Component Communication

**Parent to Child:** Props
```typescript
<ChildComponent data={data} onAction={handleAction} />
```

**Child to Parent:** Callbacks
```typescript
const ChildComponent = ({ onAction }) => {
  return <button onClick={() => onAction('value')}>Click</button>;
};
```

**Sibling Communication:** Lift state up to parent
```typescript
const Parent = () => {
  const [sharedData, setSharedData] = useState();
  return (
    <>
      <Sibling1 data={sharedData} onUpdate={setSharedData} />
      <Sibling2 data={sharedData} />
    </>
  );
};
```

---

## 🔧 Creating New Components

### Template

```typescript
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';

interface NewComponentProps {
  // Define props
  data?: any;
  onAction?: (value: any) => void;
}

export const NewComponent: React.FC<NewComponentProps> = ({ data, onAction }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load data
  }, []);

  if (error) {
    return <div>Error: {error}</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Component Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
      </CardContent>
    </Card>
  );
};
```

### Best Practices

1. **Type Safety:** Always define TypeScript interfaces for props
2. **Error Handling:** Implement error boundaries and loading states
3. **Accessibility:** Use semantic HTML and ARIA labels
4. **Performance:** Use `useCallback` and `useMemo` when appropriate
5. **Testing:** Keep components small and testable
6. **Documentation:** Add JSDoc comments for complex logic

---

## 🎯 Accessibility Guidelines

### Keyboard Navigation

Ensure all interactive elements are keyboard accessible:

```typescript
<button
  onClick={handleClick}
  onKeyDown={(e) => e.key === 'Enter' && handleClick()}
>
  Action
</button>
```

### ARIA Labels

Add ARIA labels for screen readers:

```typescript
<button aria-label="Close dialog">✕</button>
```

### Focus Management

Manage focus for modals and dynamic content:

```typescript
useEffect(() => {
  if (isOpen) {
    ref.current?.focus();
  }
}, [isOpen]);
```

---

## 📚 Additional Resources

- [React Documentation](https://react.dev/)
- [TypeScript React Documentation](https://react-typescript-cheatsheet.netlify.app/)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Radix UI Documentation](https://www.radix-ui.com/docs/primitives)
- [Accessibility Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
