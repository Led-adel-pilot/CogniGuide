-- Migration to ensure exam_date column supports time in flashcards_schedule table
-- The exam_date column should already be timestamp with time zone, but this migration
-- ensures it's properly set up and handles any existing date-only values

-- Check if the column exists and what type it is
DO $$
DECLARE
    column_type text;
BEGIN
    -- Check if exam_date column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'flashcards_schedule'
        AND column_name = 'exam_date'
    ) THEN
        -- Column doesn't exist, add it as timestamp with time zone
        ALTER TABLE public.flashcards_schedule
        ADD COLUMN exam_date timestamp with time zone null;
        RAISE NOTICE 'Added exam_date column as timestamp with time zone';
    ELSE
        -- Column exists, check its type
        SELECT data_type INTO column_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'flashcards_schedule'
        AND column_name = 'exam_date';

        IF column_type = 'date' THEN
            -- Convert from date to timestamp with time zone
            -- First, create a temporary column
            ALTER TABLE public.flashcards_schedule
            ADD COLUMN exam_datetime timestamp with time zone;

            -- Convert existing date values to datetime with default 8:00 AM
            UPDATE public.flashcards_schedule
            SET exam_datetime = (exam_date::timestamp with time zone + INTERVAL '8 hours')
            WHERE exam_date IS NOT NULL;

            -- Drop the old column and rename the new one
            ALTER TABLE public.flashcards_schedule
            DROP COLUMN exam_date;

            ALTER TABLE public.flashcards_schedule
            RENAME COLUMN exam_datetime TO exam_date;

            RAISE NOTICE 'Converted exam_date from date to timestamp with time zone';
        ELSIF column_type = 'timestamp with time zone' THEN
            -- Already correct type, no action needed
            RAISE NOTICE 'exam_date column is already timestamp with time zone - no migration needed';
        ELSE
            -- Unexpected type, raise an error
            RAISE EXCEPTION 'exam_date column has unexpected type: %. Expected date or timestamp with time zone.', column_type;
        END IF;
    END IF;
END $$;

-- Add comment for documentation (this will work regardless of whether column was just created or already existed)
COMMENT ON COLUMN public.flashcards_schedule.exam_date IS 'Exam date and time in UTC. Defaults to 8:00 AM when only date is provided.';
