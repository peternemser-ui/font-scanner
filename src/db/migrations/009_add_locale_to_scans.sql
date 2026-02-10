-- Migration: Add locale column to scans table
-- Date: 2026-02-07
-- Description: Persists the user's active i18n locale at scan time
--              so that PDF exports and report recalls render in the
--              original language, not the viewer's current locale.

ALTER TABLE scans ADD COLUMN locale TEXT DEFAULT 'en';
