-- Vincular admin existente a una organizacion
INSERT INTO "Organization" (id, name, rfc, "legalName", plan, "isActive", "createdAt", "updatedAt")
VALUES ('org-royaltica-001', 'Royaltica Demo', 'RDE240101AA1', 'Royaltica Demo SA de CV', 'ENTERPRISE', true, NOW(), NOW())
ON CONFLICT (rfc) DO NOTHING;

UPDATE "User" SET "organizationId" = 'org-royaltica-001' WHERE email = 'admin@royaltica.com' AND "organizationId" IS NULL;

SELECT id, email, name, role, "organizationId" FROM "User";
