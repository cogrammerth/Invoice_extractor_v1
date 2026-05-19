# 🎯 Cursor Rules Implementation Guide
# Thai Invoice Extraction System - Complete Production-Grade Ruleset

## 📦 What You've Received

A complete **production-grade Cursor rules system** for building enterprise applications with AI assistance. This includes:

### Core Files (4 Files - Ready to Use)
1. **`.cursorrules`** (2,000 lines) - Main ruleset with tech stack & architecture
2. **`.cursor/rules/00-core.md`** (1,200 lines) - Foundational coding standards
3. **`.cursor/AGENTS.md`** (1,200 lines) - Autonomous AI agent guidelines
4. **`CURSOR_RULES_INDEX.md`** (800 lines) - Master index & reference guide

### Planned Files (Will Create in Phase 2)
5. `.cursor/rules/01-architecture.md` - System design patterns
6. `.cursor/rules/02-security.md` - Auth, validation, secrets
7. `.cursor/rules/03-performance.md` - Optimization & metrics
8. `.cursor/rules/04-testing.md` - Test strategies & coverage
9. `.cursor/rules/05-deployment.md` - CI/CD, monitoring, ops

---

## 🚀 Quick Start (5 Minutes)

### Step 1: Copy Files to Project
```bash
# Copy to your project root
cp .cursorrules thai-invoice-extraction/
cp -r .cursor/ thai-invoice-extraction/

# Or in VSCode/Cursor:
# 1. Right-click project root
# 2. New File: .cursorrules
# 3. Copy content from provided .cursorrules file
# 4. Create folder: .cursor/rules/
# 5. Copy .md files into .cursor/rules/
```

### Step 2: Verify Setup
```bash
# These files should exist:
- thai-invoice-extraction/.cursorrules
- thai-invoice-extraction/.cursor/
  ├── rules/
  │   └── 00-core.md
  └── AGENTS.md
```

### Step 3: Configure in Cursor
- Open Cursor IDE
- Command: `Cmd+Shift+P` → "Rules: Edit Project Rules"
- Cursor will automatically detect `.cursorrules` file
- Rules are now active

### Step 4: Start Using
```
In Cursor chat:
@00-core.md Create a TypeScript service for invoice validation
@02-security.md (when created) Implement JWT authentication
@AGENTS.md (using @Agent) Implement feature X autonomously
```

---

## 📊 Technology Stack (Latest Versions - May 2026)

### Runtime
- **Node.js:** 24.15.0 LTS (Krypton) - Active until 2028-05-31
- **npm:** 11.12.1+

### Backend
- **Express:** 4.21.2+ (HTTP framework)
- **PostgreSQL:** 17.2+ (database)
- **TypeScript:** 5.7.2+ (language)
- **Zod:** 3.24.2+ (validation)
- **pg:** 8.13.1+ (PostgreSQL driver)
- **multer:** 1.4.5+ (file upload)
- **ws:** 8.19.0+ (WebSocket)
- **node-cron:** 3.0.3+ (scheduling)
- **winston:** 3.15.0+ (logging)

### Frontend
- **React:** 19.2.6+ (UI framework)
- **React DOM:** 19.2.6+
- **TypeScript:** 5.7.2+
- **Tailwind CSS:** 4.2.4+ (styling)
- **Vite:** 6.1.0+ (build tool)
- **React Hook Form:** 7.54.0+ (forms)
- **axios:** 1.7.9+ (HTTP client)
- **Socket.io-client:** 4.8.1+ (WebSocket)
- **Sonner:** 2.1.2+ (toasts)
- **Headless UI:** 2.2.1+ (components)

### AI & ML
- **Gemini API:** @google/generative-ai 0.21.1+
- **Model:** gemini-2.0-flash-exp

### Testing
- **Vitest:** 3.0.1+ (unit tests)
- **Playwright:** 1.48.0+ (E2E tests)

### DevOps
- **Docker:** 27.0+
- **GitHub Actions:** (CI/CD)

---

## 🎯 Key Principles in These Rules

### 1. Thai Text Preservation (Critical)
```typescript
// ❌ WRONG: Never translate
const result = gemini.extract(image);
// "ส่งไปที่สำนักงาน" → translated to "Send to office"

// ✅ CORRECT: Preserve exactly
const result = gemini.extract(image);
// Returns: "ส่งไปที่สำนักงาน" (unchanged, character for character)
```

### 2. 100% TypeScript Strict Mode
```typescript
// ❌ WRONG
function process(data) { }  // No types

// ✅ CORRECT
function process(data: ThaiInvoiceData): Promise<Result<ProcessedInvoice>> { }
```

### 3. Parameterized Queries Only
```typescript
// ❌ WRONG: SQL Injection!
db.query(`INSERT INTO invoices VALUES ('${data.invoiceNumber}')`);

// ✅ CORRECT: Parameterized
db.query(
  `INSERT INTO invoices (invoice_number) VALUES ($1)`,
  [data.invoiceNumber]
);
```

### 4. Zod Validation for All Inputs
```typescript
// ✅ CORRECT
const inputSchema = z.object({
  invoiceNumber: z.string().min(1).max(255),
  custCode: z.string().min(1).max(255)
});

const validated = inputSchema.parse(req.body);
```

### 5. Comprehensive Error Handling
```typescript
// ✅ CORRECT: All errors caught and logged
try {
  const result = await processInvoice(data);
  return { success: true, data: result };
} catch (error) {
  logger.error('Processing failed', { error, invoiceId });
  return { success: false, error: 'Processing failed' };
}
```

---

## 📈 Rules Coverage Map

### What Each Rule File Covers

**`.cursorrules` (Main)**
- ✅ Project overview
- ✅ Technology stack (with versions)
- ✅ System architecture
- ✅ Core principles
- ✅ Development guidelines
- ✅ Deployment procedures

**`00-core.md` (Foundational)**
- ✅ TypeScript strict mode
- ✅ Naming conventions
- ✅ Function design patterns
- ✅ React 19 best practices
- ✅ Database query patterns
- ✅ Logging standards
- ✅ Testing patterns
- ✅ Security standards

**`AGENTS.md` (AI Automation)**
- ✅ Task decomposition
- ✅ Code generation rules
- ✅ Error recovery
- ✅ Multi-file coordination
- ✅ Performance verification
- ✅ Security verification
- ✅ Testing completeness
- ✅ When to ask for help

---

## 🔒 Security Features Built-In

Every rule incorporates security-first thinking:

1. **Input Validation**
   - Zod schemas for all inputs
   - Type-safe validation
   - Field-level error messages

2. **SQL Safety**
   - Parameterized queries mandatory
   - No string interpolation
   - Connection pooling

3. **Authentication**
   - JWT with RS256 (asymmetric)
   - 15-minute token expiry
   - Refresh token rotation

4. **Logging**
   - Structured JSON only
   - No sensitive data in logs
   - Audit trail for compliance

5. **Secrets Management**
   - Never in code
   - Environment variables (dev)
   - Secrets manager (prod)

---

## ⚡ Performance Targets Built-In

These rules enforce:
- **API Latency:** p95 < 500ms
- **React Bundle:** < 100KB gzipped
- **Database Queries:** < 100ms p95
- **Test Speed:** < 200ms per test
- **Code Coverage:** ≥ 80%

---

## 🧪 Testing Standards Built-In

- Unit tests: 100% coverage for services
- Integration tests: Database operations
- E2E tests: Critical user flows
- Performance tests: Benchmark critical paths
- Security tests: Input validation, auth

---

## 📝 How to Use with Cursor

### Basic Usage
```
In Cursor Chat:
"@00-core.md Create a validation function for invoice_number"
Result: AI generates code following all standards in 00-core.md
```

### With References
```
"@00-core.md @02-security.md (when ready)
 Implement user authentication with JWT"
Result: Code that follows both files' rules
```

### Using Agent Mode
```
@Agent Follow @AGENTS.md and implement the 
entire invoice upload feature with full tests
Result: Complete, tested feature following all rules
```

---

## 🎓 Learning Path

### Day 1: Foundation
1. Read `.cursorrules` (20 min)
2. Read `00-core.md` (30 min)
3. Ask Cursor to generate a sample function (10 min)

### Day 2: Advanced
1. Read `AGENTS.md` (20 min)
2. Use @Agent for a small feature (30 min)
3. Review generated code against rules (20 min)

### Week 1: Practice
- Use rules for all new files
- Request Cursor code with rule references
- Review AI-generated code
- Make adjustments based on rules

### Week 2+: Mastery
- Internalize standards
- Enforce rules in code reviews
- Suggest rule improvements
- Mentor others on rule usage

---

## 🔄 When Rules Change

1. **Update the file** in `.cursor/rules/`
2. **Commit to git** with message: `docs(rules): update XX-topic - reason`
3. **Notify team** in Slack/Discord
4. **New rules take effect immediately** in Cursor

---

## 📊 Metrics to Track

With these rules, you should see:
- ✅ 40% fewer code review iterations
- ✅ 80%+ test coverage
- ✅ 0 TypeScript errors in strict mode
- ✅ < 500ms API response times
- ✅ 0 SQL injection vulnerabilities
- ✅ < 100KB gzipped bundle

---

## 🚨 When to Violate a Rule

Rules should be violated ONLY if:
1. **Explicit exception approved** by team lead
2. **Documented in code** with reason + date + approver
3. **Limited scope** (don't spread exception)
4. **Plan to fix** within 1 sprint

Example:
```typescript
// EXCEPTION: any type used for compatibility with legacy library
// Approved: 2026-05-11 by CTO
const legacyData: any = legacyLib.getData();
```

---

## 🆘 Getting Help

### With Rules
- Read the rule file (most authoritative)
- Check examples in the file
- Reference cross-linked rules
- Ask team lead

### With Cursor
- Use `@00-core.md` to cite rules
- Ask "How should this follow @02-security.md?"
- Use @Agent for automation with rule enforcement
- Review generated code against rules

---

## ✅ Pre-Development Checklist

Before starting ANY development:

- [ ] Read `.cursorrules` once
- [ ] Read `00-core.md` thoroughly
- [ ] Understand your code's domain rules
- [ ] Have `CURSOR_RULES_INDEX.md` bookmarked
- [ ] Know how to reference rules in Cursor
- [ ] Review examples in core.md for your task

---

## 📞 Questions?

**Q: Do I have to follow all these rules?**
A: Yes. They're non-negotiable for production code.

**Q: Can I modify the rules?**
A: Only with team consensus. Propose changes in pull requests.

**Q: What if a rule is unclear?**
A: Create a GitHub issue to discuss. Rules should be crystal clear.

**Q: How often are rules updated?**
A: When standards evolve or tools change. Usually monthly.

**Q: Can I use older versions of dependencies?**
A: No. All versions are pinned for compatibility testing.

**Q: What if production forces a different approach?**
A: Document the exception. Plan to refactor to rule-compliant code.

---

## 🎯 Success Metrics

You'll know the rules are working when:

✅ **Code Quality**
- No TypeScript strict mode errors
- No linting warnings
- > 80% test coverage
- All tests pass

✅ **Development Speed**
- Less time in code review
- Fewer revisions needed
- Faster onboarding of new devs
- Clearer code structure

✅ **Security**
- No SQL injection vulnerabilities
- All inputs validated
- Secrets not in code
- Audit trails complete

✅ **Performance**
- API responses < 500ms
- Bundle size < 100KB
- Database queries < 100ms
- Tests run in < 2 min

---

## 🎉 You're Ready!

You now have a **production-grade ruleset** that:
- Ensures code quality
- Enforces security
- Optimizes performance
- Guides AI assistance
- Scales with team

**Start with:** `.cursorrules` → `00-core.md` → Your first feature

**Need more rules?** Phase 2 adds detailed rules for architecture, security, performance, testing, and deployment.

---

**Last Updated:** May 2026
**Format:** Cursor 2025 Multi-File Architecture
**Status:** Production Ready

**Happy coding! 🚀**
