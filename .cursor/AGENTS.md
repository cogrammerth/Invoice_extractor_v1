# AGENTS.md - Cursor Agent Instructions
# How AI agents should handle autonomous coding tasks for Thai Invoice Extraction System

## Agent Operating Mode

When using Cursor in Agent mode (@Agent), the AI should follow these instructions for autonomous task execution.

---

## Task Decomposition Strategy

### Before Starting
1. **Understand the request completely** - Ask clarifying questions if ambiguous
2. **Reference the ruleset** - @ mention .cursorrules and relevant rules from .cursor/rules/
3. **Create a plan** - Show the plan to user before executing
4. **Get approval** - Never execute breaking changes without explicit OK

### Task Planning Template
```
## Task: [Name]

### Objective
[What needs to be done]

### Files to Modify/Create
- [ ] file1.ts (reason)
- [ ] file2.tsx (reason)

### Dependencies to Check
- [ ] Does package.json need updates?
- [ ] Are new types needed?
- [ ] Database schema changes?

### Testing Strategy
- Unit tests: @vitest
- Integration: @test database
- Manual: [steps to verify]

### Rollback Plan
[How to undo changes if something goes wrong]

### Estimated Time
[Effort estimation]
```

---

## Code Generation Rules for Agents

### ALWAYS
- ✅ Generate 100% TypeScript (never JavaScript)
- ✅ Include strict type definitions
- ✅ Add JSDoc comments to public functions
- ✅ Use parameterized queries for database
- ✅ Add error handling for all async operations
- ✅ Include input validation with Zod
- ✅ Write tests alongside code (TDD when possible)
- ✅ Reference this ruleset in code comments
- ✅ Check for naming convention compliance
- ✅ Verify no hardcoded values/secrets

### NEVER
- ❌ Generate JavaScript files (unless explicitly approved)
- ❌ Use `any` types
- ❌ Skip error handling
- ❌ Commit untested code
- ❌ Use string interpolation in SQL
- ❌ Log sensitive data
- ❌ Violate Thai text preservation rules
- ❌ Create circular dependencies
- ❌ Exceed complexity thresholds
- ❌ Use deprecated APIs

---

## Integration Test Execution

When writing integration tests:

```typescript
// Agent: Use this pattern for database tests
describe('ThaiInvoiceService Integration', () => {
  let db: Pool;
  
  beforeAll(async () => {
    // Connect to test database
    db = new Pool({ ...testDbConfig });
    // Run migrations
    await runMigrations(db);
  });

  afterEach(async () => {
    // Clean up test data
    await db.query('TRUNCATE TABLE thai_invoices CASCADE');
  });

  afterAll(async () => {
    // Close connections
    await db.end();
  });

  it('should insert and retrieve invoice', async () => {
    const invoiceId = uuidv4();
    await insertInvoice(db, invoiceId, testInvoiceData);
    
    const result = await getInvoice(db, invoiceId);
    expect(result).toBeDefined();
    expect(result.invoice_number).toBe(testInvoiceData.invoice_number);
  });
});
```

---

## Error Recovery Strategy

If agent encounters an error:

1. **STOP immediately** - Don't continue making changes
2. **Log the error** - Save full error message + context
3. **Diagnose** - Check:
   - Type errors: Missing types or type mismatch?
   - Compilation errors: Syntax or module issues?
   - Runtime errors: Missing dependencies or configuration?
4. **Ask for help** - Message user with:
   - Exact error message
   - File and line number
   - What it was trying to do
   - Suggested fix
5. **Wait for approval** - Don't apply fixes without OK

---

## Multi-File Coordination

When changes span multiple files:

### Order of Operations
1. **Types first** (.types.ts files)
   - Define all interfaces and types
   - Run tsc --noEmit to verify
2. **Services/Core logic** (.ts files)
   - Implement business logic
   - Unit tests included
3. **API routes** (routes/*.ts)
   - Connect to services
   - Integration tests
4. **React components** (.tsx files)
   - Use defined types
   - Component tests
5. **Database** (if needed)
   - Migrations
   - Seeds (test data)

### Circular Dependency Check
```
Agent: Before committing, verify no circular deps:
1. service A imports from service B
2. service B CANNOT import from service A
3. Use dependency injection to break cycles
```

---

## Performance Verification

Agent: For performance-sensitive code:

```typescript
// Agent: Always measure and compare
const baseline = performance.now();
const result = await expensiveOperation();
const duration = performance.now() - baseline;

console.log(`Operation took ${duration}ms (target: < 500ms)`);
console.assert(duration < 500, 'Performance regression detected');

// For React components
import { Profiler, type ProfilerOnRenderCallback } from 'react';

const onRenderCallback: ProfilerOnRenderCallback = (
  id, phase, actualDuration, baseDuration
) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
};

export function InvoiceUpload() {
  return (
    <Profiler id="invoice-upload" onRender={onRenderCallback}>
      {/* Component */}
    </Profiler>
  );
}
```

---

## Security Verification Checklist

Agent: Before completing any task, verify:

- [ ] No hardcoded secrets or API keys
- [ ] All inputs validated with Zod
- [ ] SQL uses parameterized queries
- [ ] JWT tokens have expiry
- [ ] Sensitive data not logged
- [ ] CORS only allows frontend domain
- [ ] Rate limiting enabled
- [ ] TypeScript strict mode passes
- [ ] No use of `eval()` or `Function()`
- [ ] File uploads validated (MIME + magic bytes)

---

## Testing Completeness

Agent: When writing tests:

```typescript
// Agent: Full test coverage includes:

// 1. Happy path
it('should process valid invoice', async () => {
  const result = await service.process(validInvoice);
  expect(result.success).toBe(true);
});

// 2. Edge cases
it('should handle invoice_number at max length', async () => {
  const longInvoice = { ...testInvoice, invoice_number: 'x'.repeat(255) };
  const result = await service.process(longInvoice);
  expect(result.success).toBe(true);
});

// 3. Validation errors
it('should reject missing invoice_number', async () => {
  const invalid = { ...testInvoice, invoice_number: '' };
  const result = await service.process(invalid);
  expect(result.success).toBe(false);
  expect(result.error).toContain('invoice_number');
});

// 4. Error conditions
it('should handle database connection error', async () => {
  mockDb.query.mockRejectedValue(new Error('Connection failed'));
  const result = await service.process(testInvoice);
  expect(result.success).toBe(false);
});

// 5. Performance
it('should complete within 500ms', async () => {
  const start = performance.now();
  await service.process(testInvoice);
  const duration = performance.now() - start;
  expect(duration).toBeLessThan(500);
});
```

---

## Documentation Requirements

Agent: For each new feature:

1. **Code comments** (JSDoc)
```typescript
/**
 * Validates Thai invoice data against required fields
 * 
 * @param data - Raw invoice data from extraction
 * @returns Validation result with errors if invalid
 * 
 * @example
 * const result = validateThaiInvoice(extractedData);
 * if (!result.success) {
 *   console.error('Validation failed:', result.errors);
 * }
 */
function validateThaiInvoice(data: unknown): ValidationResult {
  // implementation
}
```

2. **API documentation** (OpenAPI/Swagger)
```yaml
/api/thai-invoices/upload:
  post:
    summary: "Upload and process Thai invoices"
    description: "Accepts multiple invoice images, extracts data, validates required fields"
    parameters:
      - name: files
        in: formData
        required: true
        schema:
          type: array
          items:
            type: file
    responses:
      '200':
        description: "Upload successful"
        schema:
          $ref: '#/components/schemas/UploadResponse'
      '400':
        description: "Validation error"
```

3. **Architecture decision record** (ADR)
```markdown
# ADR-001: Using Zod for Validation

## Context
Need runtime validation for user inputs

## Decision
Use Zod for all input validation

## Rationale
- TypeScript-first
- Generates types automatically
- Better error messages than manual validation
- Smaller bundle than alternatives

## Consequences
- Learning curve for team
- Additional dependency
+ Type safety at runtime
+ Consistency across codebase
```

---

## Commit Message Standards

Agent: Use conventional commits:

```
feat(thai-invoices): add multi-page document support

- Implement document_number grouping
- Add page_number tracking
- Add is_last_page field
- Update database schema
- Write 15 unit tests (100% coverage)
- Update API documentation

Closes #123
```

---

## Code Review Simulation

Agent: Before marking a task "done", self-review:

```
Checklist:
- [ ] Code compiles without errors (tsc --noEmit)
- [ ] Linting passes (0 warnings/errors)
- [ ] Tests pass (100% suite)
- [ ] Code coverage ≥ 80%
- [ ] No TypeScript errors
- [ ] Naming conventions followed
- [ ] Security checklist passed
- [ ] Performance targets met
- [ ] Documentation complete
- [ ] Rollback plan exists
```

---

## Deployment Safety

Agent: Never deploy without:

1. **Test results** - Show passing tests
2. **Performance metrics** - Show p95 latency targets met
3. **Security scan** - npm audit, Snyk results
4. **Rollback plan** - Can we undo this quickly?
5. **Staging verification** - Tested on staging environment?

---

## Agent Constraint Violations

Agent: If you would need to violate constraints:

1. **STOP immediately**
2. **Report the constraint violation** to user
3. **Explain why it's needed**
4. **Ask for explicit approval** to proceed
5. **Document the exception** (with timestamp)

Example:
```
⚠️ CONSTRAINT VIOLATION

To implement [feature], I would need to:
- Use 'any' type in TypeScript (violates strict typing)

Reason: [explanation]

Requesting explicit approval to proceed with exception.
Exception should be documented in code:
// EXCEPTION: any type used due to [reason]
// Approved: [date] by [who]
```

---

## Long-Running Task Checkpoints

Agent: For tasks taking > 30 minutes:

Every 30 minutes:
1. Summary of progress so far
2. Remaining work estimate
3. Any blockers encountered
4. Whether to continue or break it up

Example:
```
⏱️ 30-MINUTE CHECKPOINT

Completed:
✅ Database schema migration (10 min)
✅ Service implementation (15 min)
✅ Unit tests (5 min)

Remaining:
⏳ Integration tests (20 min est)
⏳ API routes (15 min est)
⏳ React components (25 min est)
⏳ E2E tests (10 min est)

Blockers: None

Recommendation: Continue (80 min remaining)
```

---

## Success Criteria

Agent: Task is complete when:

1. ✅ All code is written
2. ✅ All tests pass
3. ✅ Type checking passes (tsc --strict)
4. ✅ Linting passes (0 warnings)
5. ✅ Code coverage ≥ 80%
6. ✅ Performance targets met
7. ✅ Security checklist passed
8. ✅ Documentation complete
9. ✅ Changes can be deployed
10. ✅ User approves completion

---

## When to Ask for Human Help

Agent: Ask for human intervention if:

- Unclear requirement (ask for clarification)
- Type safety violation needed (ask for exception)
- Performance target unachievable (ask to modify target)
- Security constraint conflict (ask for override approval)
- Test failures unexplained (ask for debug help)
- Multiple approaches unclear (ask for decision)
- Blockers encountered (ask how to proceed)
- Time estimate exceeded 2x (ask to reassess)

---

**Remember:** Agent mode is powerful but dangerous if unsupervised. Always seek explicit approval for breaking changes and communicate clearly about constraints and blockers.
