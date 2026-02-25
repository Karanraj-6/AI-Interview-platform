-- Migration: Add summary_feedback, change score columns to decimal
-- Run this on your Supabase SQL Editor

-- 1. Add summary_feedback column to interviews
ALTER TABLE public.interviews ADD COLUMN IF NOT EXISTS summary_feedback text;

-- 2. Change final_score from integer to real (decimal)
ALTER TABLE public.interviews ALTER COLUMN final_score TYPE real USING final_score::real;

-- 3. Change responses.rating from integer to real (0-1 decimal scale)
ALTER TABLE public.responses ALTER COLUMN rating TYPE real USING rating::real;
