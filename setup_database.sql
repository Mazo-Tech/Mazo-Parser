-- ============================================================================
-- MAZO PARSER - DATABASE SETUP (Complete)
-- ============================================================================
-- This file creates all tables, enums, indexes, and functions in the correct order.
-- Run this file FIRST before running individual table query files.
-- ============================================================================

-- ============================================================================
-- STEP 1: CREATE ENUM TYPES
-- ============================================================================

-- Create app_role enum (for user_roles table)
DO $$ BEGIN
    CREATE TYPE app_role AS ENUM ('admin', 'user');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create document_type enum (for parsing_history table)
DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('resume', 'job_description');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: CREATE TABLES (in dependency order)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Table 1: profiles (depends on auth.users)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID NOT NULL PRIMARY KEY,
    email TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT profiles_id_fkey FOREIGN KEY (id) 
        REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Table 2: user_roles (depends on profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    role app_role DEFAULT 'user'::app_role,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ----------------------------------------------------------------------------
-- Table 3: parsing_history (depends on profiles)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.parsing_history (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL,
    document_type document_type NOT NULL,
    parsed_content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT parsing_history_user_id_fkey FOREIGN KEY (user_id) 
        REFERENCES public.profiles(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 3: CREATE INDEXES
-- ============================================================================

-- Profiles indexes
CREATE UNIQUE INDEX IF NOT EXISTS profiles_pkey ON public.profiles USING btree (id);

-- User roles indexes
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_pkey ON public.user_roles USING btree (id);

-- Parsing history indexes
CREATE UNIQUE INDEX IF NOT EXISTS parsing_history_pkey ON public.parsing_history USING btree (id);

-- Optional performance indexes (uncomment if needed)
-- CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
-- CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);
-- CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
-- CREATE INDEX IF NOT EXISTS idx_parsing_history_user_id ON public.parsing_history(user_id);
-- CREATE INDEX IF NOT EXISTS idx_parsing_history_created_at ON public.parsing_history(created_at);
-- CREATE INDEX IF NOT EXISTS idx_parsing_history_document_type ON public.parsing_history(document_type);

-- ============================================================================
-- STEP 4: CREATE FUNCTIONS
-- ============================================================================

-- Function: is_admin
-- Check if a user has admin role
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  role_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = $1
    AND user_roles.role = 'admin'
  ) INTO role_exists;
  
  RETURN role_exists;
END;
$$;

-- ============================================================================
-- STEP 5: ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parsing_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- STEP 6: CREATE RLS POLICIES (Examples - adjust as needed)
-- ============================================================================

-- Profiles policies
DO $$ BEGIN
    -- Users can view their own profile
    CREATE POLICY "Users can view own profile"
    ON public.profiles
    FOR SELECT
    USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Users can update their own profile
    CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    USING (auth.uid() = id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- User roles policies
DO $$ BEGIN
    -- Users can view their own role
    CREATE POLICY "Users can view own role"
    ON public.user_roles
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Parsing history policies
DO $$ BEGIN
    -- Users can view their own parsing history
    CREATE POLICY "Users can view own parsing history"
    ON public.parsing_history
    FOR SELECT
    USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Users can insert their own parsing history
    CREATE POLICY "Users can insert own parsing history"
    ON public.parsing_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    -- Users can delete their own parsing history
    CREATE POLICY "Users can delete own parsing history"
    ON public.parsing_history
    FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Check that all tables were created successfully
SELECT 
    schemaname,
    tablename,
    tableowner
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'user_roles', 'parsing_history')
ORDER BY tablename;

-- Check that all enums were created successfully
SELECT 
    typname as enum_name,
    array_agg(enumlabel ORDER BY enumsortorder) as enum_values
FROM pg_type t 
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typname IN ('app_role', 'document_type')
GROUP BY typname
ORDER BY typname;

-- ============================================================================
-- SETUP COMPLETE
-- ============================================================================
-- All tables, indexes, functions, and RLS policies have been created.
-- You can now use the individual query files:
-- - profiles.sql
-- - user_roles.sql
-- - parsing_history.sql
-- ============================================================================

