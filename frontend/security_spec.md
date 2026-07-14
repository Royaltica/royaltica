# Security Specification: Royáltica Fortress

## Data Invariants
1. A user can only access their own profile metadata.
2. An audit log is immutable: once written, it cannot be modified or deleted.
3. Only authenticated users can perform AI audits (enforced via rules and service).

## The Dirty Dozen (Test Payloads)
1. Write to another user's profile.
2. Update an existing audit record.
3. Delete an audit record.
4. Create an audit record with 1MB of "analysis" text.
5. Create a user profile with role: 'admin' (not in enum).
6. List all audits without filters.
7. Spoof ownerId on an audit record.
8. Self-assign 'corporate' role without verification.
9. Bypass server timestamp on audit creation.
10. Inject script tags into provider name.
11. Large array poisoning in audit checks.
12. Read private user metadata.

## Test Runner (Draft)
A separate test file will verify that all these payloads return PERMISSION_DENIED.
