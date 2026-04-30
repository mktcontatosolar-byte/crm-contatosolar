import { describe, expect, it } from "vitest"

import {
  canManageProjects,
  canManageTeam,
  canViewCompetition,
  canViewCompetitionValue,
  canViewDashboard,
  canViewProjects,
  canViewSensitiveProjectData,
  hasRoleAtLeast,
  isAdminRole,
  isOwnerRole,
} from "@/lib/permissions"

describe("permissions", () => {
  it("dono tem acesso máximo nas permissões exclusivas", () => {
    expect(isOwnerRole("dono")).toBe(true)
    expect(isAdminRole("dono")).toBe(true)
    expect(canManageProjects("dono")).toBe(true)
    expect(canViewProjects("dono")).toBe(true)
    expect(canViewSensitiveProjectData("dono")).toBe(true)
    expect(canManageTeam("dono")).toBe(true)
  })

  it("admin tem acesso operacional sem poderes exclusivos de dono", () => {
    expect(isOwnerRole("admin")).toBe(false)
    expect(isAdminRole("admin")).toBe(true)
    expect(canManageTeam("admin")).toBe(true)
    expect(canViewDashboard("admin")).toBe(true)
    expect(canViewCompetition("admin")).toBe(true)
    expect(canViewCompetitionValue("admin")).toBe(true)
    expect(canManageProjects("admin")).toBe(false)
    expect(canViewProjects("admin")).toBe(false)
    expect(canViewSensitiveProjectData("admin")).toBe(false)
  })

  it("corretor tem acesso restrito e não acessa áreas administrativas", () => {
    expect(isOwnerRole("corretor")).toBe(false)
    expect(isAdminRole("corretor")).toBe(false)
    expect(canManageTeam("corretor")).toBe(false)
    expect(canManageProjects("corretor")).toBe(false)
    expect(canViewProjects("corretor")).toBe(false)
    expect(canViewSensitiveProjectData("corretor")).toBe(false)
    expect(canViewDashboard("corretor")).toBe(true)
    expect(canViewCompetition("corretor")).toBe(true)
  })

  it("hasRoleAtLeast respeita hierarquia e trata nulos", () => {
    expect(hasRoleAtLeast("dono", "admin")).toBe(true)
    expect(hasRoleAtLeast("admin", "dono")).toBe(false)
    expect(hasRoleAtLeast("corretor", "corretor")).toBe(true)
    expect(hasRoleAtLeast(null, "corretor")).toBe(false)
    expect(hasRoleAtLeast(undefined, "admin")).toBe(false)
  })

  it("com role nula/undefined helpers retornam acesso negado", () => {
    expect(isOwnerRole(null)).toBe(false)
    expect(isAdminRole(undefined)).toBe(false)
    expect(canManageTeam(undefined)).toBe(false)
    expect(canViewDashboard(null)).toBe(false)
    expect(canViewProjects(undefined)).toBe(false)
    expect(canViewCompetition(null)).toBe(false)
    expect(canViewSensitiveProjectData(undefined)).toBe(false)
  })

  it("role desconhecida não eleva privilégios", () => {
    const unknownRole = "guest" as unknown as Parameters<typeof isAdminRole>[0]

    expect(isOwnerRole(unknownRole)).toBe(false)
    expect(isAdminRole(unknownRole)).toBe(false)
    expect(canManageTeam(unknownRole)).toBe(false)
    expect(canManageProjects(unknownRole)).toBe(false)
    expect(canViewProjects(unknownRole)).toBe(false)
    expect(canViewSensitiveProjectData(unknownRole)).toBe(false)
  })
})
