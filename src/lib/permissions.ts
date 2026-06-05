import type { UserRole } from "@/types"

export const ROLE_LABEL: Record<UserRole, string> = {
  dono: "Dono",
  admin: "Admin",
  corretor: "Vendedor",
}

const ROLE_WEIGHT: Record<UserRole, number> = {
  corretor: 1,
  admin: 2,
  dono: 3,
}

export function hasRoleAtLeast(role: UserRole | null | undefined, minimum: UserRole) {
  if (!role) {
    return false
  }

  return ROLE_WEIGHT[role] >= ROLE_WEIGHT[minimum]
}

export function isOwnerRole(role: UserRole | null | undefined) {
  return role === "dono"
}

export function isAdminRole(role: UserRole | null | undefined) {
  return hasRoleAtLeast(role, "admin")
}

export function canManageProjects(role: UserRole | null | undefined) {
  return isOwnerRole(role)
}

export function canViewProjects(role: UserRole | null | undefined) {
  return isOwnerRole(role)
}

export function canExportProjects(role: UserRole | null | undefined) {
  return isOwnerRole(role)
}

export function canViewCompetition(role: UserRole | null | undefined) {
  return hasRoleAtLeast(role, "corretor")
}

export function canViewDashboard(role: UserRole | null | undefined) {
  return hasRoleAtLeast(role, "corretor")
}

export function canViewSensitiveProjectData(role: UserRole | null | undefined) {
  return isOwnerRole(role)
}

export function canViewCompetitionValue(role: UserRole | null | undefined) {
  return hasRoleAtLeast(role, "corretor")
}

export function canManageTeam(role: UserRole | null | undefined) {
  return hasRoleAtLeast(role, "admin")
}

export function canViewCalculadora(role: UserRole | null | undefined) {
  return isAdminRole(role)
}

export function canManageCalculadoraConfig(role: UserRole | null | undefined) {
  return isAdminRole(role)
}
