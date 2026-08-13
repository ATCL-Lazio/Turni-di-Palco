-- Adds attendee_id to ticket_activations to support attendee-bound ownership
-- check in activate_by_details (closes #1582, unblocks attendee activation
-- regression fix for #1580).
--
-- reserve_hash now accepts an optional attendeeId payload param (the intended
-- recipient's user UUID). activate_by_details enforces
-- ticket.attendee_id = caller when the column is non-NULL; rows without
-- attendee_id (pre-migration or reservations without a known recipient) are
-- allowed through for backward compatibility.

ALTER TABLE public.ticket_activations
  ADD COLUMN IF NOT EXISTS attendee_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ticket_activations_attendee_id_idx
  ON public.ticket_activations (attendee_id)
  WHERE attendee_id IS NOT NULL;
