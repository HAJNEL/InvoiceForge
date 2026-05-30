# InvoiceForge Security Specification

## Data Invariants
1. An invoice must always belong to the user who created it (`userId` match).
2. Users can only see and manage their own invoices and clients.
3. Invoice numbers must be strings of reasonable length.
4. Total amounts cannot be negative.

## The Dirty Dozen Payloads (Targeting Invoices)
1. **Identity Spoofing**: Attempt to create an invoice for someone else's `userId`.
2. **Unauthorized Read**: Attempt to read an invoice ID belonging to another user.
3. **Malicious Update**: Attempt to change the `userId` of an existing invoice to take ownership.
4. **Invalid Status**: Attempt to set status to 'god-mode' or other non-existent status.
5. **PII Leak**: Attempting to query all invoices across all users without a `userId` filter.
6. **Resource Exhaustion**: Creating an invoice with 1MB of junk in the `notes` field.
7. **Negative Amount**: Setting `totalAmount` to -1000000.
8. **Broken Reference**: Creating an invoice for a non-existent client (Relational Integrity).
9. **Timestamp Manipulation**: Setting `createdAt` to a future date manually.
10. **Shadow Field Injection**: Adding `isVerified: true` to bypass hypothetical business logic.
11. **Mass Deletion**: Attempting to delete documents in bulk without being the owner.
12. **ID Poisoning**: Using a 1KB string as an `invoiceId`.

## Test Scenarios
- [ ] `create` (owner) -> ALLOW
- [ ] `create` (wrong userId) -> DENY
- [ ] `read` (owner) -> ALLOW
- [ ] `read` (stranger) -> DENY
- [ ] `update` (owner, change amount) -> ALLOW
- [ ] `update` (owner, change userId) -> DENY
