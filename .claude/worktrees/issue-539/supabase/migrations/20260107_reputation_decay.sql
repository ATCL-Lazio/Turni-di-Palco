-- Add last_activity_at column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMPTZ DEFAULT now();

-- Update existing profiles to have the current timestamp if null
UPDATE public.profiles 
SET last_activity_at = now() 
WHERE last_activity_at IS NULL;
