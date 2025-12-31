# Technical Documentation - Mazo Beam Parser

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Database Schema](#database-schema)
4. [Authentication & Authorization](#authentication--authorization)
5. [API Integration](#api-integration)
6. [Document Parsing Pipeline](#document-parsing-pipeline)
7. [Matching Algorithm](#matching-algorithm)
8. [Deployment](#deployment)
9. [Troubleshooting](#troubleshooting)
10. [Migration History](#migration-history)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React + Vite)                  │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │  File Upload │  │  Parsing UI  │  │  History View   │   │
│  └──────────────┘  └──────────────┘  └─────────────────┘   │
└───────────────────────┬─────────────────────────────────────┘
                        │
                        │ HTTP/REST
                        │
        ┌───────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
┌────────────────┐              ┌─────────────────┐
│  Supabase      │              │  Gemini AI      │
│  - Auth        │              │  - Parsing      │
│  - PostgreSQL  │              │  - Extraction   │
│  - Storage     │              │                 │
│  - RLS         │              │                 │
└────────────────┘              └─────────────────┘
```

### Application Flow

```
User Login
    ↓
Upload Documents (JDs + Resumes)
    ↓
Parse with Gemini AI
    ↓
Extract Structured Data
    ↓
Calculate Skills Matching
    ↓
Generate Excel Report
    ↓
Save to History (Database)
    ↓
Display in UI
```

---

## Technology Stack

### Frontend
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **UI Library**: shadcn/ui
- **Styling**: Tailwind CSS
- **State Management**: TanStack Query (React Query)
- **Routing**: React Router v6
- **Form Handling**: React Hook Form
- **Excel Generation**: SheetJS (xlsx)
- **PDF Parsing**: pdf-parse
- **DOCX Parsing**: mammoth

### Backend
- **BaaS**: Supabase
  - PostgreSQL Database
  - Authentication (JWT)
  - Row Level Security (RLS)
  - Real-time subscriptions

### AI/ML
- **Parsing Engine**: Google Gemini 2.5 Flash
- **API**: Google Generative Language API

### Development Tools
- **Package Manager**: npm
- **Type Checking**: TypeScript
- **Code Quality**: ESLint
- **Version Control**: Git

---

## Database Schema

### Tables

#### 1. `profiles`

Stores user profile information.

```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- Primary Key: `id`

**Foreign Keys:**
- `id` → `auth.users.id` (CASCADE DELETE)

**RLS Policies:**
- Users can view only their own profile
- Auto-created via trigger on user signup

---

#### 2. `user_roles`

Manages user roles (admin/user).

```sql
CREATE TYPE app_role AS ENUM ('admin', 'user');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  role app_role DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- Primary Key: `id`
- `idx_user_roles_user_id` on `user_id` (for performance)

**Foreign Keys:**
- `user_id` → `profiles.id` (CASCADE DELETE)

**RLS Policies:**
- Admins can view all roles
- Users can view only their own role
- Only admins can insert/update roles

---

#### 3. `parsing_history`

Stores parsing session history.

```sql
CREATE TYPE document_type AS ENUM ('resume', 'job_description');

CREATE TABLE public.parsing_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  document_type document_type NOT NULL,
  parsed_content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:**
- Primary Key: `id`
- `idx_parsing_history_user_id` on `user_id` (for performance)

**Foreign Keys:**
- `user_id` → `profiles.id` (CASCADE DELETE)

**RLS Policies:**
- Users can view only their own history
- Users can insert only with their own user_id
- Users can delete only their own history

**JSONB Structure (`parsed_content`):**
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

---

### Database Functions

#### `handle_new_user()`

Automatically creates a profile when a new user signs up.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Trigger:**
```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

#### `is_admin()`

Checks if the current user is an admin.

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
```

---

## Authentication & Authorization

### Authentication Flow

1. **User Registration:**
   ```typescript
   await supabase.auth.signUp({
     email: 'user@example.com',
     password: 'securePassword123'
   });
   // Trigger creates profile automatically
   ```

2. **User Login:**
   ```typescript
   await supabase.auth.signInWithPassword({
     email: 'user@example.com',
     password: 'securePassword123'
   });
   ```

3. **Session Management:**
   - JWT tokens stored in localStorage
   - Auto-refresh on token expiry
   - Session persists across page reloads

### Row Level Security (RLS)

All tables have RLS enabled with optimized policies:

**Optimization Applied:**
```sql
-- Before (re-evaluated per row)
CREATE POLICY "policy_name" ON table_name
FOR SELECT USING (auth.uid() = user_id);

-- After (evaluated once)
CREATE POLICY "policy_name" ON table_name
FOR SELECT USING ((SELECT auth.uid()) = user_id);
```

### Security Best Practices

1. **API Keys**: Stored in environment variables, never committed
2. **Function Security**: SECURITY DEFINER with explicit `search_path`
3. **Foreign Keys**: All have proper indexes for performance
4. **RLS**: Prevents unauthorized data access at database level

---

## API Integration

### Supabase Client Configuration

**File:** `src/integrations/supabase/client.ts`

```typescript
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://pjwdugunungwndjykwus.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbG..."; // anon key

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);
```

**Note:** Uses `anon` key (not `service_role`) for client-side security.

### Gemini AI Integration

**File:** `src/utils/geminiParser.ts`

```typescript
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export async function parseWithGemini(
  text: string,
  documentType: 'resume' | 'job_description',
  fileName: string
): Promise<ParsedDocument | ParsedResume> {
  // Validation
  if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_new_api_key_here') {
    throw new Error('Gemini API key is not configured');
  }

  // API call
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  // Parse and return structured data
}
```

---

## Document Parsing Pipeline

### Step 1: File Upload

```typescript
// src/components/FileUpload.tsx
const handleFiles = async (files: File[]) => {
  const validFiles = files.filter(file => 
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );
  
  onFileUpload(validFiles);
};
```

### Step 2: Text Extraction

```typescript
// PDF
import pdf from 'pdf-parse';
const dataBuffer = await file.arrayBuffer();
const data = await pdf(Buffer.from(dataBuffer));
const text = data.text;

// DOCX
import mammoth from 'mammoth';
const arrayBuffer = await file.arrayBuffer();
const result = await mammoth.extractRawText({ arrayBuffer });
const text = result.value;
```

### Step 3: AI Parsing

**Prompt Structure:**

```typescript
const prompt = `
Extract the following information from this ${documentType}:

${documentType === 'resume' ? `
- Full Name
- Email Address
- Phone Number
- Skills (technical and soft skills)
- Years of Experience
- Education
` : `
- Job Title
- Required Skills
- Required Experience (years)
- Responsibilities
`}

Document text:
${text}

Return JSON format only.
`;
```

### Step 4: Retry Logic with Exponential Backoff

```typescript
async function parseWithRetry(text: string, maxAttempts = 3) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await parseWithGemini(text, documentType, fileName);
    } catch (error) {
      if (attempt === maxAttempts) throw error;
      
      // Exponential backoff
      const delay = Math.pow(2, attempt) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

### Step 5: Data Validation & Cleaning

```typescript
function validateParsedData(data: any): ParsedResume {
  return {
    name: data.name || 'Unknown',
    email: validateEmail(data.email) || '',
    phone: formatPhone(data.phone) || '',
    skills: Array.isArray(data.skills) ? data.skills.filter(Boolean) : [],
    experience: extractYears(data.experience) || '0',
    education: data.education || ''
  };
}
```

---

## Matching Algorithm

### Skills Matching Implementation

**File:** `src/pages/Index.tsx`

```typescript
function calculateMatchPercentage(
  candidateSkills: string[],
  requiredSkills: string[]
): number {
  if (!requiredSkills.length || !candidateSkills.length) return 0;

  // Normalize skills
  const normalizedRequired = requiredSkills
    .filter(skill => typeof skill === 'string')
    .map(skill => skill.toLowerCase().trim());
  
  const normalizedCandidate = candidateSkills
    .filter(skill => typeof skill === 'string')
    .map(skill => skill.toLowerCase().trim());

  const matchedSkills = new Map<string, boolean>();
  let matchCount = 0;

  // 1. Exact matches
  for (const required of normalizedRequired) {
    if (normalizedCandidate.includes(required)) {
      matchCount++;
      matchedSkills.set(required, true);
    }
  }

  // 2. Partial matches (multi-word skills)
  for (const required of normalizedRequired) {
    if (matchedSkills.has(required)) continue;
    
    if (required.includes(' ')) {
      const parts = required.split(' ');
      if (normalizedCandidate.some(candidate =>
        parts.every(part => candidate.includes(part))
      )) {
        matchCount++;
        matchedSkills.set(required, true);
      }
    }
  }

  // 3. Substantial matches (substring matching)
  for (const required of normalizedRequired) {
    if (matchedSkills.has(required)) continue;
    
    for (const candidate of normalizedCandidate) {
      const isMatch = 
        candidate.includes(` ${required} `) ||
        candidate.startsWith(`${required} `) ||
        candidate.endsWith(` ${required}`) ||
        candidate === required;
      
      if (isMatch) {
        matchCount++;
        matchedSkills.set(required, true);
        break;
      }
    }
  }

  // 4. Technology equivalents
  const equivalents = [
    ['sql', 'mysql', 'postgresql', 'ms sql', 'sql server'],
    ['aws', 'amazon web services'],
    ['react', 'react.js'],
    ['vue', 'vue.js'],
    ['node', 'node.js'],
    // ... more equivalents
  ];

  for (const required of normalizedRequired) {
    if (matchedSkills.has(required)) continue;
    
    for (const group of equivalents) {
      if (group.includes(required)) {
        const hasEquivalent = normalizedCandidate.some(candidate =>
          group.some(equiv => candidate.includes(equiv))
        );
        if (hasEquivalent) {
          matchCount++;
          matchedSkills.set(required, true);
          break;
        }
      }
    }
  }

  return Math.round((matchCount / normalizedRequired.length) * 100);
}
```

### Qualification Determination

```typescript
function getSkillResult(percentage: number): string {
  if (percentage >= 80) return "Highly Qualified";
  if (percentage >= 50) return "Qualified";
  return "Not Qualified";
}

function getExperienceResult(
  candidateExp: string,
  requiredExp: string
): string {
  const candidate = parseInt(candidateExp) || 0;
  const required = parseInt(requiredExp) || 0;
  return candidate >= required ? "Qualified" : "Not Qualified";
}
```

---

## Deployment

### Environment Variables

**Production `.env`:**
```bash
VITE_GEMINI_API_KEY=your_production_api_key
```

### Build Process

```bash
# Install dependencies
npm install

# Build for production
npm run build

# Output directory: dist/
```

### Supabase Configuration

**Required Settings:**
1. **Database URL**: Configure in Supabase dashboard
2. **Anon Key**: Public key for client-side operations
3. **RLS Policies**: Must be enabled on all tables
4. **Triggers**: Ensure user profile trigger is active

### Security Checklist

- [ ] Environment variables set
- [ ] API keys are valid and not exposed
- [ ] RLS policies enabled on all tables
- [ ] HTTPS enforced
- [ ] CORS configured properly
- [ ] Database backups enabled
- [ ] Error logging configured

---

## Troubleshooting

### Database Issues

#### Issue: 409 Conflict on History Insert

**Cause:** Missing user profile (foreign key violation)

**Solution:**
```sql
-- Check if profile exists
SELECT * FROM profiles WHERE id = '<user-id>';

-- Create profile if missing
INSERT INTO profiles (id, email)
SELECT id, email FROM auth.users
WHERE id = '<user-id>';
```

#### Issue: RLS Blocking Queries

**Diagnosis:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'parsing_history';

-- Test policy
SET ROLE authenticated;
SET request.jwt.claim.sub = '<user-id>';
SELECT * FROM parsing_history;
```

### API Issues

#### Issue: Gemini API 400 Error

**Causes:**
1. Invalid API key
2. Malformed request
3. Rate limit exceeded

**Solutions:**
```typescript
// Validate API key
if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_new_api_key_here') {
  throw new Error('Invalid API key');
}

// Add rate limiting
await new Promise(resolve => setTimeout(resolve, 1000));
```

#### Issue: Supabase Connection Failed

**Diagnosis:**
```typescript
// Test connection
const { data, error } = await supabase.from('profiles').select('*').limit(1);
console.log('Connection test:', { data, error });
```

### Performance Issues

#### Slow Parsing

**Optimizations:**
1. Batch processing with concurrency limits
2. Parallel processing of independent files
3. Caching frequently used data

```typescript
// Process in batches of 5
const BATCH_SIZE = 5;
for (let i = 0; i < files.length; i += BATCH_SIZE) {
  const batch = files.slice(i, i + BATCH_SIZE);
  await Promise.all(batch.map(file => parseDocument(file)));
}
```

#### Database Query Optimization

**Indexes:**
```sql
-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_parsing_history_user_id 
ON parsing_history(user_id);

CREATE INDEX IF NOT EXISTS idx_parsing_history_created_at 
ON parsing_history(created_at DESC);
```

---

## Migration History

### Migration 1: `fix_is_admin_search_path`

**Date:** 2025-12-31  
**Purpose:** Security fix for function search_path

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = (SELECT auth.uid())
    AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
```

### Migration 2: `add_foreign_key_indexes`

**Date:** 2025-12-31  
**Purpose:** Performance optimization

```sql
CREATE INDEX IF NOT EXISTS idx_parsing_history_user_id 
ON parsing_history(user_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id 
ON user_roles(user_id);
```

### Migration 3: `optimize_rls_policies`

**Date:** 2025-12-31  
**Purpose:** RLS policy performance

```sql
-- Changed from: auth.uid() = user_id
-- To: (SELECT auth.uid()) = user_id
-- Prevents re-evaluation for each row
```

### Migration 4: `fix_profiles_and_history`

**Date:** 2025-12-31  
**Purpose:** Auto-create user profiles

```sql
-- Create missing profiles
INSERT INTO public.profiles (id, email)
SELECT id, email FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE profiles.id = auth.users.id
);

-- Add trigger for auto-profile creation
CREATE FUNCTION public.handle_new_user() ...
CREATE TRIGGER on_auth_user_created ...
```

---

## API Reference

### Supabase Client Operations

#### Authentication

```typescript
// Sign up
const { data, error } = await supabase.auth.signUp({
  email: string,
  password: string
});

// Sign in
const { data, error } = await supabase.auth.signInWithPassword({
  email: string,
  password: string
});

// Get current user
const { data: { user } } = await supabase.auth.getUser();

// Sign out
await supabase.auth.signOut();
```

#### Database Operations

```typescript
// Insert history
const { data, error } = await supabase
  .from('parsing_history')
  .insert({
    document_type: 'resume',
    parsed_content: {...},
    user_id: user.id
  });

// Fetch history
const { data, error } = await supabase
  .from('parsing_history')
  .select('*')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false });

// Delete history
const { error } = await supabase
  .from('parsing_history')
  .delete()
  .eq('id', recordId);
```

---

## Performance Metrics

### Target Metrics

- **Page Load**: < 2 seconds
- **Document Parsing**: 3-10 seconds per document
- **Batch Processing**: ~30 seconds for 10 documents
- **Report Generation**: < 5 seconds
- **History Load**: < 1 second

### Monitoring

```typescript
// Add performance timing
console.time('parsing');
await parseDocument(file);
console.timeEnd('parsing');
```

---

## Development Guidelines

### Code Structure

```
src/
├── components/          # React components
│   ├── ui/             # shadcn/ui components
│   ├── FileUpload.tsx
│   ├── DocumentParser.tsx
│   └── ParsingHistory.tsx
├── pages/              # Page components
│   ├── Index.tsx
│   └── Auth.tsx
├── integrations/       # External service integrations
│   └── supabase/
│       ├── client.ts
│       └── types.ts
├── utils/              # Utility functions
│   ├── geminiParser.ts
│   └── colorCoding.ts
├── types/              # TypeScript type definitions
│   └── index.ts
└── hooks/              # Custom React hooks
    └── use-toast.ts
```

### TypeScript Types

```typescript
// src/types/index.ts
export interface ParsedResume {
  name: string;
  email: string;
  phone: string;
  skills: string[];
  experience: string;
  education: string;
}

export interface ParsedDocument {
  title: string;
  skills: string[];
  experience: string;
  responsibilities: string[];
}

export interface Candidate extends ParsedResume {
  matchPercentage: number;
  fileName: string;
  positionMatches: PositionMatch[];
  bestMatchingPosition: string;
}

export interface PositionMatch {
  title: string;
  matchPercentage: number;
  experience: string;
  skills: string[];
}
```

---

## Appendix

### Useful SQL Queries

```sql
-- View all users with roles
SELECT 
  p.email,
  ur.role,
  p.created_at
FROM profiles p
LEFT JOIN user_roles ur ON ur.user_id = p.id;

-- Count parsing history by user
SELECT 
  p.email,
  COUNT(ph.id) as total_reports
FROM profiles p
LEFT JOIN parsing_history ph ON ph.user_id = p.id
GROUP BY p.email;

-- Recent parsing activity
SELECT 
  p.email,
  ph.document_type,
  ph.created_at
FROM parsing_history ph
JOIN profiles p ON p.id = ph.user_id
ORDER BY ph.created_at DESC
LIMIT 10;
```

### Environment Setup Checklist

- [ ] Node.js installed (v18+)
- [ ] npm/yarn installed
- [ ] Supabase project created
- [ ] Database tables created
- [ ] RLS policies enabled
- [ ] Triggers installed
- [ ] Gemini API key obtained
- [ ] `.env` file configured
- [ ] Dependencies installed
- [ ] Development server running

---

**Document Version:** 1.0.0  
**Last Updated:** December 31, 2025  
**Maintained By:** Development Team

