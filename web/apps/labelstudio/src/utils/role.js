export function canManageProject(user) {
  return Boolean(user && typeof user.org_role === "string" && ["admin", "owner"].includes(user.org_role));
}
