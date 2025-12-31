# Technical Documentation - Mazo Beam Parser

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [API Reference](#api-reference)
5. [Component Architecture](#component-architecture)
6. [Data Flow](#data-flow)
7. [Authentication & Authorization](#authentication--authorization)
8. [Document Parsing Pipeline](#document-parsing-pipeline)
9. [Matching Algorithm](#matching-algorithm)
10. [Performance Considerations](#performance-considerations)
11. [Security Implementation](#security-implementation)
12. [Deployment](#deployment)
13. [Error Handling](#error-handling)
14. [Testing Strategy](#testing-strategy)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (React)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Pages      │  │  Components  │  │    Utils     │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ HTTPS/REST API
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    Supabase Backend                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Auth API   │  │  Database     │  │ Edge Function│      │
│  │              │  │  (PostgreSQL)│  │  (Deno)      │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            │ API Call
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                    OpenAI API                                │
│              (Gemini 1.5 Flash for parsing)                  │
└──────────────────────────────────────────────────────────────┘
```

### Application Flow

1. **User Authentication**: Supabase Auth handles login/logout
2. **File Upload**: Files uploaded via React Dropzone
3. **Document Parsing**: Edge Function calls OpenAI API
4. **Data Storage**: Parsed data stored in PostgreSQL
5. **Matching**: Client-side algorithm matches candidates to positions
6. **Report Generation**: Excel reports generated using XLSX library

---

## Technology Stack

### Frontend

- **Framework**: React 18.3.1
- **Language**: TypeScript 5.5.3
- **Build Tool**: Vite 5.4.1
- **Routing**: React Router DOM 6.26.2
- **State Management**: TanStack Query (React Query) 5.56.2
- **UI Library**: Radix UI + shadcn/ui components
- **Styling**: Tailwind CSS 3.4.11
- **Form Handling**: React Hook Form 7.53.0
- **File Processing**: 
  - `pdf-parse` 1.1.1 (PDF parsing)
  - `mammoth` 1.9.0 (DOCX parsing)
- **Export**: `xlsx` 0.18.5 (Excel generation)
- **Date Handling**: `date-fns` 3.6.0

### Backend

- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Edge Functions**: Deno runtime
- **AI Service**: OpenAI GPT-4o-mini

### Development Tools

- **Linting**: ESLint 9.9.0
- **Type Checking**: TypeScript
- **Package Manager**: npm/bun

---

## Database Schema

### Tables

#### `profiles`
```sql
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Stores user profile information linked to Supabase Auth users.

**Relationships**:
- One-to-one with `auth.users`
- One-to-many with `user_roles`
- One-to-many with `parsing_history`

#### `user_roles`
```sql
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    role app_role DEFAULT 'user'::app_role,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Manages user roles for authorization (admin/user).

**Enum Values**: `'admin'`, `'user'`

#### `parsing_history`
```sql
CREATE TABLE public.parsing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    document_type document_type NOT NULL,
    parsed_content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
```

**Purpose**: Stores historical parsing records with full parsed data.

**JSONB Structure**:
```typescript
{
  jobDescriptions: Array<{
    title: string;
    skills: string[];
    experience: string;
    responsibilities: string[];
  }>;
  candidates: Array<{
    name: string;
    email: string;
    phone: string;
    skills: string[];
    experience: string;
    education: string;
    matchPercentage: number;
    fileName: string;
    bestMatchingPosition: string;
    positionMatches: Array<{
      title: string;
      matchPercentage: number;
      experience: string;
      skills: string[];
    }>;
  }>;
}
```

### Functions

#### `is_admin(user_id UUID) → BOOLEAN`
```sql
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
```

**Purpose**: Checks if a user has admin role.

**Usage**: `SELECT public.is_admin('user-uuid');`

### Indexes

- `profiles_pkey` - Primary key on `profiles.id`
- `user_roles_pkey` - Primary key on `user_roles.id`
- `parsing_history_pkey` - Primary key on `parsing_history.id`

### Row Level Security (RLS)

All tables have RLS enabled. Policies ensure:
- Users can only access their own data
- Admins can access all data
- Proper isolation between users

---

## API Reference

### Supabase Client

**Location**: `src/integrations/supabase/client.ts`

```typescript
import { supabase } from '@/integrations/supabase/client';
```

### Authentication Methods

#### `getSession()`
```typescript
const { data: { session }, error } = await supabase.auth.getSession();
```

#### `signInWithPassword({ email, password })`
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string
});
```

#### `signOut()`
```typescript
const { error } = await supabase.auth.signOut();
```

#### `getUser()`
```typescript
const { data: { user }, error } = await supabase.auth.getUser();
```

#### `onAuthStateChange(callback)`
```typescript
const { data: { subscription } } = supabase.auth.onAuthStateChange(
  (event, session) => { /* handle change */ }
);
```

### Database Queries

#### Select Parsing History
```typescript
const { data, error } = await supabase
  .from('parsing_history')
  .select('*')
  .eq('document_type', 'resume')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });
```

#### Insert Parsing History
```typescript
const { data, error } = await supabase
  .from('parsing_history')
  .insert({
    document_type: 'resume',
    parsed_content: { /* JSON object */ },
    user_id: user.id
  });
```

#### Delete Parsing History
```typescript
const { error } = await supabase
  .from('parsing_history')
  .delete()
  .eq('id', recordId);
```

#### Select User Role
```typescript
const { data, error } = await supabase
  .from('user_roles')
  .select('role')
  .eq('user_id', user.id)
  .maybeSingle();
```

### Edge Function API

**Endpoint**: `https://[project-ref].supabase.co/functions/v1/parse-document`

**Method**: `POST`

**Headers**:
```
Authorization: Bearer [anon_key]
Content-Type: application/json
```

**Request Body**:
```typescript
{
  documentText: string;
  documentType: 'resume' | 'jd';
}
```

**Response**:
```typescript
// For Resume
{
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  education: string;
}

// For Job Description
{
  title: string;
  skills: string[];
  experience: string;
  responsibilities: string[];
}
```

---

## Component Architecture

### Page Components

#### `App.tsx`
- Root component
- Manages authentication state
- Sets up routing
- Configures React Query client

#### `Auth.tsx`
- Login page
- Handles authentication
- Session persistence

#### `Index.tsx`
- Main application page
- File upload handling
- Matching algorithm
- Report generation
- User role checking

#### `NotFound.tsx`
- 404 error page

### Feature Components

#### `DocumentParser.tsx`
- Document parsing logic
- Batch processing
- Progress tracking
- Error handling

#### `FileUpload.tsx`
- File upload UI
- Drag and drop support
- File validation
- Progress indicators

#### `CandidateTable.tsx`
- Displays parsed candidates
- Match percentages
- Sorting and filtering
- Color-coded results

#### `JobDescription.tsx`
- Displays job descriptions
- Skills and requirements
- Experience details

#### `MatchingVisuals.tsx`
- Visual representation of matches
- Charts and graphs
- Statistics display

#### `ParsingHistory.tsx`
- Historical records display
- Report download
- Record deletion
- Auto-refresh (5s interval)

#### `UserManagement.tsx`
- User CRUD operations (admin only)
- Role management
- User listing

### UI Components

Located in `src/components/ui/`, built with Radix UI and shadcn/ui:
- Buttons, Inputs, Tables
- Dialogs, Alerts, Toasts
- Forms, Cards, Badges
- And 30+ other components

---

## Data Flow

### Document Upload Flow

```
1. User selects files
   ↓
2. FileUpload component validates files
   ↓
3. DocumentParser.processBatch() called
   ↓
4. For each file:
   a. Extract text (PDF/DOCX)
   b. Call Edge Function
   c. Edge Function calls OpenAI API
   d. Parse JSON response
   ↓
5. Update state with parsed data
   ↓
6. Trigger matching algorithm
   ↓
7. Display results in CandidateTable
```

### Matching Flow

```
1. Job descriptions uploaded
   ↓
2. Resumes uploaded
   ↓
3. For each candidate:
   a. Calculate match for each JD
   b. Find best matching position
   c. Store position matches
   ↓
4. Update candidate state
   ↓
5. Render with color coding
```

### Report Generation Flow

```
1. User clicks "Generate Report"
   ↓
2. Validate data exists
   ↓
3. Get current user
   ↓
4. Insert into parsing_history
   ↓
5. Generate Excel report:
   a. Create workbook
   b. Add worksheet
   c. Format columns
   d. Apply color coding
   ↓
6. Download file
   ↓
7. Clear state
```

---

## Authentication & Authorization

### Authentication Flow

1. User enters credentials
2. `signInWithPassword()` called
3. Supabase Auth validates credentials
4. Session token returned
5. Session stored in browser
6. `onAuthStateChange` listener updates app state
7. Protected routes check session

### Authorization

**Role-Based Access Control (RBAC)**:
- `admin`: Full access, user management
- `user`: Standard access, own data only

**Implementation**:
```typescript
const { data: userRole } = useQuery({
  queryKey: ['user-role'],
  queryFn: async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();
    return data?.role || null;
  }
});
```

**Protected Routes**:
- `/` - Requires authentication
- `/auth` - Redirects if authenticated
- User Management - Requires admin role

---

## Document Parsing Pipeline

### Text Extraction

**PDF Files**:
```typescript
import pdf from 'pdf-parse';
const data = await pdf(buffer);
const text = data.text;
```

**DOCX Files**:
```typescript
import mammoth from 'mammoth';
const result = await mammoth.extractRawText({ arrayBuffer });
const text = result.value;
```

### AI Parsing

**Edge Function** (`supabase/functions/parse-document/index.ts`):

1. Receives document text and type
2. Constructs prompt based on type
3. Calls OpenAI API (GPT-4o-mini)
4. Parses JSON response
5. Validates and normalizes data
6. Returns structured data

**Prompt Engineering**:
- Resume: Extract name, email, phone, skills, experience, education
- Job Description: Extract title, skills, experience, responsibilities
- Emphasizes accuracy and completeness
- Handles edge cases (nested arrays, missing fields)

**Error Handling**:
- Retry logic with exponential backoff
- Rate limit handling
- Validation of AI responses
- Fallback for malformed data

---

## Matching Algorithm

### Skill Matching

**Location**: `src/pages/Index.tsx` - `calculateMatchPercentage()`

**Algorithm Steps**:

1. **Normalization**:
   ```typescript
   const normalized = skills.map(s => s.toLowerCase().trim());
   ```

2. **Exact Matching**:
   - Direct string comparison
   - Case-insensitive

3. **Partial Matching**:
   - Multi-word skills: Check if all words present
   - Substring matching for compound skills

4. **Technology Equivalents**:
   ```typescript
   const equivalents = [
     ['sql', 'mysql', 'postgresql', 'ms sql'],
     ['aws', 'amazon web services'],
     ['react', 'react.js'],
     // ... more groups
   ];
   ```

5. **Percentage Calculation**:
   ```typescript
   percentage = (matchedSkills / totalRequiredSkills) * 100
   ```

### Experience Matching

```typescript
const candidateExp = parseInt(candidate.experience || '0');
const jdExp = parseInt(jd.experience || '0');
const qualified = candidateExp >= jdExp;
```

### Result Classification

- **Select** (Green): 70%+ match
- **Hold** (Yellow): 40-69% match
- **Reject** (Red): <40% match

---

## Performance Considerations

### Optimization Strategies

1. **React Query Caching**:
   - Parsing history cached
   - User role cached
   - Automatic refetch intervals

2. **Batch Processing**:
   - Files processed in batches
   - Maximum 100 files per batch
   - Progress tracking

3. **Lazy Loading**:
   - Components loaded on demand
   - Code splitting with Vite

4. **Database Indexes**:
   - Primary keys indexed
   - Foreign keys indexed
   - Consider adding indexes on `user_id`, `created_at`

5. **Edge Function Optimization**:
   - Retry logic prevents unnecessary calls
   - Exponential backoff for rate limits
   - Efficient prompt construction

### Limitations

- Maximum 10 job descriptions
- Maximum 25 resumes
- Maximum 100 files per batch
- Parsing history auto-refresh: 5 seconds

---

## Security Implementation

### Row Level Security (RLS)

**Policies** (conceptual):
```sql
-- Users can only see their own parsing history
CREATE POLICY "user_own_history"
ON parsing_history FOR SELECT
USING (auth.uid() = user_id);

-- Users can only insert their own records
CREATE POLICY "user_insert_own"
ON parsing_history FOR INSERT
WITH CHECK (auth.uid() = user_id);
```

### Authentication Security

- JWT tokens managed by Supabase
- Session stored securely
- Automatic token refresh
- Secure password handling

### API Security

- Edge Functions require authentication
- API keys stored in environment variables
- CORS configured properly
- Input validation on all endpoints

### Data Validation

- File type validation
- File size limits
- Input sanitization
- Type checking with TypeScript

---

## Deployment

### Environment Variables

**Frontend** (`.env`):
```env
VITE_SUPABASE_URL=https://[project-ref].supabase.co
VITE_SUPABASE_ANON_KEY=[anon-key]
```

**Edge Function** (Supabase Secrets):
```bash
supabase secrets set OPENAI_API_KEY=[openai-key]
```

### Build Process

```bash
# Development build
npm run build:dev

# Production build
npm run build
```

### Supabase Deployment

1. **Database**:
   - Run migrations from `database_queries.sql`
   - Configure RLS policies
   - Set up triggers if needed

2. **Edge Functions**:
   ```bash
   supabase functions deploy parse-document
   ```

3. **Frontend**:
   - Build: `npm run build`
   - Deploy to hosting (Vercel, Netlify, etc.)
   - Configure environment variables

---

## Error Handling

### Error Types

1. **Authentication Errors**:
   - Invalid credentials
   - Session expired
   - Unauthorized access

2. **Parsing Errors**:
   - Invalid file format
   - Corrupted files
   - API failures
   - Rate limiting

3. **Database Errors**:
   - Connection failures
   - RLS violations
   - Constraint violations

4. **Validation Errors**:
   - File size exceeded
   - File count exceeded
   - Missing required data

### Error Handling Strategy

```typescript
try {
  // Operation
} catch (error: any) {
  console.error('Error:', error);
  toast({
    title: "Error",
    description: error.message,
    variant: "destructive",
  });
}
```

### User Feedback

- Toast notifications for errors
- Loading states during operations
- Validation messages
- Error boundaries (recommended)

---

## Testing Strategy

### Recommended Tests

1. **Unit Tests**:
   - Matching algorithm
   - Utility functions
   - Data transformations

2. **Integration Tests**:
   - API calls
   - Database operations
   - Authentication flow

3. **E2E Tests**:
   - Complete user workflows
   - File upload and parsing
   - Report generation

### Testing Tools

- **Jest** - Unit testing
- **React Testing Library** - Component testing
- **Playwright/Cypress** - E2E testing
- **MSW** - API mocking

---

## API Rate Limits

### OpenAI API

- Model: GPT-4o-mini
- Rate limits: Varies by tier
- Retry logic: Exponential backoff (5 retries)
- Max tokens: 2048 per request

### Supabase

- Database: Standard Supabase limits
- Edge Functions: 60s timeout
- Auth: Standard limits

---

## Monitoring & Logging

### Logging Points

1. **Frontend**:
   - Console logs for debugging
   - Error logging
   - User actions

2. **Edge Function**:
   - Request/response logging
   - Error tracking
   - Performance metrics

3. **Database**:
   - Query logs (via Supabase dashboard)
   - Connection logs
   - Performance metrics

### Recommended Monitoring

- Supabase Dashboard for database metrics
- Edge Function logs in Supabase dashboard
- Browser DevTools for frontend debugging
- Error tracking service (Sentry, etc.)

---

## Future Enhancements

### Potential Improvements

1. **Performance**:
   - Implement virtual scrolling for large lists
   - Add database query optimization
   - Implement caching strategies

2. **Features**:
   - Advanced filtering and search
   - Bulk operations
   - Email notifications
   - API endpoints for external integrations

3. **UX**:
   - Real-time progress updates
   - Better error messages
   - Accessibility improvements

4. **Security**:
   - Enhanced RLS policies
   - Audit logging
   - Rate limiting

---

## Support & Maintenance

### Documentation

- `README.md` - User guide
- `TECHNICAL_DOCUMENTATION.md` - This file
- `DATABASE_QUERIES.md` - Query documentation
- `database_queries.sql` - SQL schema and queries

### Code Organization

- Components: Feature-based organization
- Utils: Reusable functions
- Types: Centralized type definitions
- Hooks: Custom React hooks

---

**Last Updated**: 2025-01-31
**Version**: 1.0.0

