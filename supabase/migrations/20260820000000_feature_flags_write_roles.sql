-- Issue #1681: restrict writes on mobile_feature_flags to operational roles.
-- Previously any control_*/dev_* role in JWT app_metadata (including the read-only
-- dev_viewer and control_auditor) could insert/update feature flags.
-- Operational roles kept: control_admin, control_operator, dev_admin, dev_operator
-- (control_operator/dev_operator are the roles the control-plane maps to "operator").
-- SELECT policy and grants are unchanged.
--
-- Rollback: re-create both policies with the previous role array
--   ['control_admin','control_operator','control_auditor','dev_admin','dev_operator','dev_viewer'].

drop policy if exists "mobile feature flags write dev roles" on public.mobile_feature_flags;
create policy "mobile feature flags write dev roles"
on public.mobile_feature_flags
for insert
to authenticated
with check (
  public.control_plane_has_any_role(
    array['control_admin', 'control_operator', 'dev_admin', 'dev_operator']::text[]
  )
);

drop policy if exists "mobile feature flags update dev roles" on public.mobile_feature_flags;
create policy "mobile feature flags update dev roles"
on public.mobile_feature_flags
for update
to authenticated
using (
  public.control_plane_has_any_role(
    array['control_admin', 'control_operator', 'dev_admin', 'dev_operator']::text[]
  )
)
with check (
  public.control_plane_has_any_role(
    array['control_admin', 'control_operator', 'dev_admin', 'dev_operator']::text[]
  )
);
