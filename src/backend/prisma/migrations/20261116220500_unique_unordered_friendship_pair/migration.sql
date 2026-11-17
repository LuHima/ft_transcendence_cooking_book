-- Deduplicate any mirrored friendship pairs before enforcing symmetric uniqueness,
-- preserving accepted > pending > rejected and newest row on ties.
DELETE FROM "friendships" a
USING "friendships" b
WHERE a.id <> b.id
  AND LEAST(a.requester_id, a.addressee_id) = LEAST(b.requester_id, b.addressee_id)
  AND GREATEST(a.requester_id, a.addressee_id) = GREATEST(b.requester_id, b.addressee_id)
  AND (
    (CASE a.status WHEN 'accepted' THEN 3 WHEN 'pending' THEN 2 ELSE 1 END)
      < (CASE b.status WHEN 'accepted' THEN 3 WHEN 'pending' THEN 2 ELSE 1 END)
    OR (
      (CASE a.status WHEN 'accepted' THEN 3 WHEN 'pending' THEN 2 ELSE 1 END)
        = (CASE b.status WHEN 'accepted' THEN 3 WHEN 'pending' THEN 2 ELSE 1 END)
      AND a.id < b.id
    )
  );

-- Enforce unordered pair uniqueness so mirrored (A,B) and (B,A) rows cannot coexist.
CREATE UNIQUE INDEX IF NOT EXISTS "friendships_pair_unique_idx"
ON "friendships" (LEAST("requester_id", "addressee_id"), GREATEST("requester_id", "addressee_id"));
