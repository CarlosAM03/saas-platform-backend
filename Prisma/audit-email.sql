-- Read-only preflight. Run with restricted administrative access; output contains
-- account identifiers, not email addresses. No renaming, merging or deletion.
WITH canonical AS (
 SELECT id, email, lower(btrim(email, U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF')) AS normalized FROM users
)
SELECT array_agg(id ORDER BY id) AS conflicting_account_ids, count(*) AS accounts
FROM canonical GROUP BY normalized HAVING count(*) > 1;
