# Cursor Rules Architecture - Thai Invoice Extraction System
# Master Index for .cursor/rules/ Multi-File Structure (2025 Format)

## 📂 Directory Structure

```
thai-invoice-extraction/
├── .cursorrules (legacy single-file support, redirects to .cursor/)
└── .cursor/
    ├── rules/
    │   ├── 00-core.md (★ START HERE - fundamental standards)
    │   ├── 01-architecture.md (system design & patterns)
    │   ├── 02-security.md (auth, validation, secrets)
    │   ├── 03-performance.md (optimization & metrics)
    │   ├── 04-testing.md (test strategies & coverage)
    │   └── 05-deployment.md (CI/CD, monitoring, ops)
    ├── AGENTS.md (instructions for Cursor Agent mode)
    ├── index.mdc (optional: single-file overview)
    └── skills/ (optional: MCP server definitions)
```

---

## 📋 File Descriptions & Contents

### .cursorrules (Root Level)
**Location:** `thai-invoice-extraction/.cursorrules`
**Purpose:** Legacy support + main ruleset overview
**Size:** ~2,000 lines
**Update Frequency:** Monthly or with major changes

**Contains:**
- Project overview & vision statement
- Complete technology stack (with versions)
- System architecture diagrams
- Core development principles (Thai text, type safety, security)
- Validation rules for required fields
- Deployment & operations guidelines
- Metrics & KPIs
- AI generation guidelines for Cursor/Claude

**When to Reference:**
- First time setting up project
- Onboarding new team members
- Reviewing project constraints
- During architecture discussions

---

### .cursor/rules/00-core.md ★ START HERE
**Purpose:** Foundational coding standards (non-negotiable)
**Size:** ~1,200 lines
**Update Frequency:** When standards change

**Contains:**
1. **TypeScript Standards** (100% requirement)
   - tsconfig.json configuration
   - Strict mode settings
   - Type patterns and examples
   
2. **Naming Conventions**
   - Files: kebab-case
   - Classes: PascalCase
   - Functions/variables: camelCase
   - Constants: UPPER_SNAKE_CASE
   - Booleans: is/has prefix
   
3. **Function Design**
   - Single responsibility principle
   - Error handling patterns
   - Result type pattern
   
4. **React 19 Best Practices**
   - Component structure
   - New React 19 features (ref props, Context)
   - Hooks rules and patterns
   
5. **Database Query Patterns**
   - Parameterized queries (SQL injection prevention)
   - Transaction patterns
   - Connection pooling
   
6. **Logging Standards**
   - Structured JSON logging
   - What to log (and what NOT to)
   - Log levels and categories
   
7. **Performance Standards**
   - Response time targets
   - Bundle size targets
   - Monitoring code examples
   
8. **Testing Patterns**
   - Unit test structure (Vitest)
   - Test naming conventions
   - Coverage requirements
   
9. **Security Standards**
   - Input validation with Zod
   - Authentication patterns
   - Secrets management

**When to Reference:**
- Before writing any code
- During code review
- When unsure about style/patterns
- Every new file creation

---

### .cursor/rules/01-architecture.md
**Purpose:** System design, patterns, and architectural decisions
**Size:** ~1,500 lines
**Status:** Will be created in Phase 2

**Expected Contents:**
- System architecture diagram (Mermaid)
- Module boundaries & dependencies
- Data flow diagrams
- Design patterns used (Factory, Observer, etc.)
- Event-driven architecture for WebSockets
- Scalability architecture
- Database schema design rationale
- Caching strategy
- File organization philosophy

**When to Reference:**
- Planning new features
- Understanding existing modules
- Performance optimization work
- Refactoring decisions

---

### .cursor/rules/02-security.md
**Purpose:** Security guidelines, authentication, authorization
**Size:** ~1,200 lines
**Status:** Will be created in Phase 2

**Expected Contents:**
- JWT configuration & refresh tokens
- RBAC (Role-Based Access Control) matrix
- SQL injection prevention
- XSS protection strategies
- CSRF token handling
- Secrets management hierarchy
- API rate limiting configuration
- CORS policy
- Data encryption standards
- Security audit checklist
- Vulnerability scanning workflow
- Compliance requirements (GDPR, SOC2, PCI-DSS if applicable)

**When to Reference:**
- Implementing authentication flows
- Adding API endpoints
- Handling sensitive data
- Security audit preparation

---

### .cursor/rules/03-performance.md
**Purpose:** Optimization guidelines, metrics, monitoring
**Size:** ~1,000 lines
**Status:** Will be created in Phase 2

**Expected Contents:**
- Performance budget (FCP, LCP, FID, CLS)
- Database query optimization
- Caching strategies (Redis, HTTP)
- React rendering optimization
- Bundle size optimization
- API response time targets
- Load testing procedures
- Profiling tools and methods
- Bottleneck identification
- Performance regression testing
- Monitoring dashboards setup
- Alerting thresholds

**When to Reference:**
- Optimizing slow endpoints
- React component performance issues
- Database query tuning
- Build optimization

---

### .cursor/rules/04-testing.md
**Purpose:** Testing strategy, frameworks, coverage requirements
**Size:** ~1,500 lines
**Status:** Will be created in Phase 2

**Expected Contents:**
- Testing pyramid (unit/integration/e2e ratios)
- Vitest configuration and patterns
- React Testing Library patterns
- Test database setup (with Docker)
- Mock strategies
- Fixtures and test data
- Coverage requirements (80% minimum)
- CI/CD test automation
- Load testing with k6 or Apache JMeter
- Security testing (OWASP)
- Performance testing metrics
- Test naming conventions
- Debugging failing tests

**When to Reference:**
- Writing test cases
- Setting up test environment
- Improving code coverage
- Test-driven development (TDD)

---

### .cursor/rules/05-deployment.md
**Purpose:** CI/CD, deployment procedures, monitoring, operations
**Size:** ~1,500 lines
**Status:** Will be created in Phase 2

**Expected Contents:**
- GitHub Actions workflow configuration
- Deployment environments (dev/staging/prod)
- Database migration strategy
- Rollback procedures
- Environment variable management
- Docker build & deployment
- Kubernetes manifests (if using)
- Monitoring setup (Prometheus/Grafana)
- Alerting configuration
- Log aggregation (ELK/Datadog)
- Backup & disaster recovery
- Incident response procedures
- Production troubleshooting guide
- Security scanning in CI/CD

**When to Reference:**
- Setting up CI/CD pipelines
- Deploying to production
- Responding to incidents
- Monitoring and alerting

---

### .cursor/AGENTS.md
**Purpose:** Instructions for Cursor's Agent mode (autonomous coding)
**Size:** ~1,200 lines
**Update Frequency:** As Agent mode evolves

**Contains:**
1. **Task Decomposition Strategy**
   - Planning template
   - Approval workflows
   
2. **Code Generation Rules**
   - ALWAYS checklist
   - NEVER checklist
   
3. **Integration Test Patterns**
   - Database test setup
   - Transaction isolation
   
4. **Error Recovery**
   - Stop & diagnose workflow
   - How to ask for help
   
5. **Multi-File Coordination**
   - Order of operations
   - Dependency checking
   
6. **Performance Verification**
   - Measurement patterns
   - React profiling
   
7. **Security Verification**
   - Pre-completion checklist
   - No secrets, validated inputs, etc.
   
8. **Testing Completeness**
   - Happy path + edge cases + errors
   - Coverage requirements
   
9. **Documentation Requirements**
   - JSDoc patterns
   - API docs format
   - Architecture Decision Records
   
10. **Commit Message Standards**
    - Conventional commits
    - Clear descriptions
    
11. **Code Review Simulation**
    - Self-review checklist
    
12. **Deployment Safety**
    - Pre-deployment verification
    
13. **Constraint Violations**
    - How to report exceptions
    
14. **Long-Running Checkpoints**
    - 30-minute progress updates
    
15. **Success Criteria**
    - Definition of done
    
16. **When to Ask for Help**
    - Blockers and exceptions

**When to Reference:**
- Using @Agent in Cursor
- Setting up agentic workflows
- Autonomous code generation
- Long-running coding tasks

---

## 🎯 How to Use These Rules

### For Individual Development
1. **First:** Read .cursorrules overview
2. **Always:** Follow 00-core.md for every file
3. **When relevant:** Reference specific topic rules (02-security, 03-performance, etc.)
4. **During review:** Use checklist from AGENTS.md

### For Team Projects
1. **Setup:** Copy entire .cursor/ folder to project root
2. **Onboarding:** Have developers read .cursorrules first
3. **Enforcement:** Reference these in code reviews
4. **Updates:** Make changes to rules files, commit to git
5. **Team alignment:** Discuss rule changes in team meetings

### For Cursor AI Assistance
1. **@mention rules:** `@00-core.md for TypeScript standards`
2. **Ask for enforcement:** "Ensure this follows @02-security.md"
3. **Request verification:** "Verify this meets @04-testing.md requirements"
4. **Use Agent mode:** Follow AGENTS.md when using @Agent

---

## 📊 Rules Maturity Status

| File | Status | Completeness | Phase |
|------|--------|-------------|-------|
| .cursorrules | ✅ Complete | 100% | 1 (Now) |
| 00-core.md | ✅ Complete | 100% | 1 (Now) |
| 01-architecture.md | 🔲 Planned | 0% | 2 |
| 02-security.md | 🔲 Planned | 0% | 2 |
| 03-performance.md | 🔲 Planned | 0% | 2 |
| 04-testing.md | 🔲 Planned | 0% | 2 |
| 05-deployment.md | 🔲 Planned | 0% | 2 |
| AGENTS.md | ✅ Complete | 100% | 1 (Now) |

---

## 🔄 How Rules Are Updated

### Adding New Rules
1. Create new file: `.cursor/rules/XX-topic.md`
2. Follow existing format
3. Add to this index
4. Commit with message: `docs(rules): add XX-topic.md`

### Modifying Existing Rules
1. Edit rule file
2. Update version timestamp
3. Add change summary at top
4. Commit with message: `docs(rules): update XX-topic.md - [reason]`

### Deprecating Rules
1. Mark as deprecated with replacement reference
2. Keep file for 1 month
3. Remove in next major version

---

## 🔗 Cross-References

Rules frequently reference each other:
- **00-core.md** → References 02-security for specific patterns
- **02-security.md** → Extends concepts from 00-core.md
- **03-performance.md** → Uses patterns from 00-core.md
- **04-testing.md** → Tests patterns defined in 00-core.md
- **AGENTS.md** → Enforces all rules from above

---

## 📖 Reading Guide by Role

### Backend Developer
1. Read: .cursorrules (overview)
2. Study: 00-core.md (TypeScript, Database, Logging)
3. Reference: 02-security.md, 03-performance.md, 05-deployment.md

### Frontend Developer
1. Read: .cursorrules (overview)
2. Study: 00-core.md (TypeScript, React 19)
3. Reference: 03-performance.md, 04-testing.md

### DevOps/SRE
1. Read: .cursorrules (overview)
2. Study: 05-deployment.md (CI/CD, monitoring)
3. Reference: 03-performance.md

### New Team Member
1. Read: .cursorrules (full overview)
2. Study: 00-core.md (comprehensive standards)
3. Reference: As you write code for specific areas

### Cursor/Claude Users
1. Read: AGENTS.md (how AI should work)
2. Reference: 00-core.md when asking for code
3. Use: @mention syntax for specific rules

---

## ✅ Validation Checklist

Before marking rules as "done":
- [ ] No grammatical errors
- [ ] All code examples tested
- [ ] Cross-references accurate
- [ ] Tools/versions current
- [ ] Team reviewed and approved
- [ ] Committed to git
- [ ] This index updated
- [ ] Team notified of changes

---

## 📞 Questions About Rules?

If unclear on what a rule means:
1. Read the rule file directly (most authoritative)
2. Check surrounding context in that file
3. Review linked rules (cross-references)
4. Ask team lead or architect
5. Create GitHub issue to discuss/clarify

---

**This is the central reference for all development practices. When in doubt, check here first.**

**Last Updated:** May 2026
**Format Version:** 2025 Multi-File Architecture
**Team:** Thai Invoice Extraction Team
