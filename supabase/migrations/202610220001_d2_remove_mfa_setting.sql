-- D2 (plan §15) dropped by the owner (sole admin, 2026-10-22): the Security/MFA
-- surface is removed from the panel entirely. This deletes the `settings.security`
-- row (`{"require_mfa": ...}`) that the flag rode on — old migrations stay
-- untouched. Idempotent: plain DELETE, safe to re-apply on any DB state.
delete from public.settings where key = 'security';
