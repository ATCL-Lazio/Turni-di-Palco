// Bearer tokens accepted by the fake GoTrue, mapped to the user each one resolves to.
export const USERS = {
  "tok-admin": {
    id: "00000000-0000-4000-8000-00000000000a",
    email: "admin@example.test",
    app_metadata: { roles: ["dev_admin"] },
  },
  "tok-operator": {
    id: "00000000-0000-4000-8000-00000000000b",
    email: "operator@example.test",
    app_metadata: { role: "operator" },
  },
  "tok-operator2": {
    id: "00000000-0000-4000-8000-00000000000c",
    email: "operator2@example.test",
    app_metadata: { role: "control_operator" },
  },
  // Tries to self-escalate through user_metadata, which users can write themselves.
  "tok-viewer": {
    id: "00000000-0000-4000-8000-00000000000d",
    email: "viewer@example.test",
    app_metadata: { role: "viewer" },
    user_metadata: { role: "dev_admin", roles: ["dev_admin"] },
  },
  // No claims: roles come only from the role table (one active, one revoked).
  "tok-table": {
    id: "00000000-0000-4000-8000-00000000000e",
    email: "table@example.test",
    app_metadata: {},
  },
  // Allowlisted email, no role anywhere.
  "tok-noroles": {
    id: "00000000-0000-4000-8000-00000000000f",
    email: "noroles@example.test",
    app_metadata: {},
  },
  // Valid Supabase user whose email is not allowlisted.
  "tok-stranger": {
    id: "00000000-0000-4000-8000-000000000010",
    email: "stranger@example.test",
    app_metadata: { roles: ["dev_admin"] },
  },
};

export const ALLOWED_EMAILS = [
  "admin@example.test",
  "operator@example.test",
  "Operator2@Example.test",
  "viewer@example.test",
  "table@example.test",
  "noroles@example.test",
].join(",");

export function roleTableRows() {
  return [
    { id: "r1", user_id: USERS["tok-table"].id, role: "dev_operator", revoked_at: null },
    { id: "r2", user_id: USERS["tok-table"].id, role: "dev_admin", revoked_at: "2026-01-01T00:00:00.000Z" },
    { id: "r3", user_id: USERS["tok-viewer"].id, role: "not_a_role", revoked_at: null },
  ];
}
