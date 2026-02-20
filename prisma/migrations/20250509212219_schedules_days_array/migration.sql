/*
  Warnings:

  - The `days` column on the `Schedule` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- 20250509212219_schedules_days_array
ALTER TABLE "Schedule"
    ALTER COLUMN "days" TYPE text[]
        USING string_to_array("days", ','); -- convierte líneas existentes

-- opcional: crea restricción para admitir sólo 7 valores válidos
CREATE OR REPLACE FUNCTION chk_weekdays(text[]) RETURNS boolean
    LANGUAGE sql IMMUTABLE AS
$$ SELECT bool_and(elem IN ('MON','TUE','WED','THU','FRI','SAT','SUN'))
   FROM unnest($1) AS elem; $$;

ALTER TABLE "Schedule"
    ADD CONSTRAINT schedule_days_check
    CHECK (chk_weekdays("days"));
