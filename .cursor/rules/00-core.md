# Core Development Standards
# Path: .cursor/rules/00-core.md
# This is the foundational ruleset for all development

## TypeScript Standards (100% - No Exceptions)

### Configuration
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  }
}
```

### Type Declarations
```typescript
// ✅ GOOD: Explicit types everywhere
function processInvoice(
  data: ThaiInvoiceData, 
  userId: string
): Promise<ProcessResult> {
  // implementation
}

// ❌ BAD: Implicit typing
function processInvoice(data, userId) {
  // no types = security risk
}

// ✅ GOOD: Use branded types for validation
type ValidatedInvoiceNumber = string & { readonly __brand: 'InvoiceNumber' };
function createValidatedInvoiceNumber(value: string): ValidatedInvoiceNumber {
  if (value.length < 1 || value.length > 255) {
    throw new Error('Invalid invoice number');
  }
  return value as ValidatedInvoiceNumber;
}

// ❌ BAD: Runtime validation without type system support
const invoiceNumber = value; // not validated at compile time
```

### Generic Types
```typescript
// ✅ GOOD: Properly constrained generics
interface ApiResponse<T extends Record<string, unknown>> {
  success: boolean;
  data?: T;
  error?: string;
}

// ✅ GOOD: Generic with default type parameter
type Result<T = unknown> = 
  | { success: true; data: T }
  | { success: false; error: string };

// ❌ BAD: Unconstrained generics
interface ApiResponse<T> {
  data: T; // T could be anything, no constraints
}
```

---

## Naming Conventions

### Files
```typescript
// ✅ CORRECT
- invoice-upload.tsx (components)
- thai-invoice-extractor.ts (services)
- invoice.types.ts (types)
- database.config.ts (configuration)
- useInvoiceUpload.ts (hooks)
- .test.ts (tests)

// ❌ WRONG
- InvoiceUpload.tsx (PascalCase for files)
- ThaiInvoiceExtractor.ts (use camelCase)
- Invoices_types.ts (mix of cases)
```

### Variables & Functions
```typescript
// ✅ CORRECT
const maxFileSize = 10 * 1024 * 1024;
let isProcessing = false;
function extractInvoiceData(input: Buffer): ThaiInvoiceData {
  // implementation
}
const getUserEmail = (userId: string): string => {
  // implementation
};

// ❌ WRONG
const MaxFileSize = 10 * 1024 * 1024; // constants aren't PascalCase
let processing = false; // boolean needs is/has prefix
function ExtractInvoiceData() { } // functions aren't PascalCase
```

### Constants
```typescript
// ✅ CORRECT
const MAX_FILE_SIZE_MB = 10;
const DEFAULT_TOKEN_EXPIRY_HOURS = 24;
const GEMINI_API_TIMEOUT_MS = 30000;

// ❌ WRONG
const maxFileSize = 10; // constants need UPPER_SNAKE_CASE
const timeout = 30000; // no context in name
```

### Classes
```typescript
// ✅ CORRECT
class ThaiInvoiceExtractionService {
  private readonly geminiClient: GoogleGenerativeAI;
  private dbPool: Pool;

  async extractInvoice(buffer: Buffer): Promise<ThaiInvoiceData> {
    // implementation
  }
}

// ❌ WRONG
class thai_invoice_service { } // PascalCase required
class Service { } // too generic
```

---

## Function Design

### Keep Functions Small & Focused
```typescript
// ✅ GOOD: Single responsibility
function validateInvoiceNumber(value: string): Result<ValidatedInvoiceNumber> {
  if (!value || value.length > 255) {
    return { 
      success: false, 
      error: 'Invalid invoice number length' 
    };
  }
  return { 
    success: true, 
    data: value as ValidatedInvoiceNumber 
  };
}

function validateCustCode(value: string): Result<ValidatedCustCode> {
  if (!value || value.length > 255) {
    return { 
      success: false, 
      error: 'Invalid customer code' 
    };
  }
  return { 
    success: true, 
    data: value as ValidatedCustCode 
  };
}

// Combined validation
function validateThaiInvoice(data: unknown): Result<ThaiInvoiceData> {
  const invoiceResult = validateInvoiceNumber(data.invoice_number);
  if (!invoiceResult.success) return invoiceResult;

  const custResult = validateCustCode(data.cust_code);
  if (!custResult.success) return custResult;

  // ... validate other fields
}

// ❌ BAD: Massive validation function
function validateInvoice(data: any) {
  // 200 lines of validation logic
  // multiple validation concerns mixed
  // hard to test
}
```

### Error Handling Pattern
```typescript
// ✅ GOOD: Explicit error handling
async function processInvoice(invoiceId: string): Promise<Result<ProcessedInvoice>> {
  try {
    const data = await extractInvoice(invoiceId);
    const validated = validateData(data);
    
    if (!validated.success) {
      return { success: false, error: validated.error };
    }

    const saved = await saveToDatabase(validated.data);
    return { success: true, data: saved };
  } catch (error) {
    logger.error('Invoice processing failed', { 
      invoiceId, 
      error: error instanceof Error ? error.message : String(error) 
    });
    return { 
      success: false, 
      error: 'Failed to process invoice' 
    };
  }
}

// ❌ BAD: Swallowing errors
function processInvoice(invoiceId: string) {
  try {
    return extractInvoice(invoiceId);
  } catch (e) {
    // error ignored - silent failure
    return null;
  }
}
```

---

## React 19 Best Practices

### Component Structure
```typescript
// ✅ GOOD: Functional component with React 19 patterns
interface InvoiceUploadProps {
  onSuccess: (result: ProcessResult) => void;
  maxFiles?: number;
}

export function InvoiceUpload({ 
  onSuccess, 
  maxFiles = 5 
}: InvoiceUploadProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleUpload = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await api.uploadInvoices(files);
      onSuccess(result);
    } catch (error) {
      logger.error('Upload failed', { error });
    } finally {
      setIsProcessing(false);
    }
  }, [files, onSuccess]);

  return (
    <div>
      {/* JSX */}
    </div>
  );
}

// ❌ BAD: Class components (outdated)
class InvoiceUpload extends React.Component {
  // Lots of boilerplate code
}
```

### React 19 Features
```typescript
// ✅ GOOD: Direct ref usage (no forwardRef needed)
function FileInput({ ref, ...props }: { ref: React.Ref<HTMLInputElement> }) {
  return <input ref={ref} {...props} />;
}

// ✅ GOOD: Direct Context usage
const ThemeContext = createContext<Theme | null>(null);

function App() {
  return (
    <ThemeContext value={theme}>  {/* No .Provider needed */}
      <Child />
    </ThemeContext>
  );
}

// ✅ GOOD: useActionState for form handling
function LoginForm() {
  const [state, action] = useActionState(
    async (prevState, formData) => {
      try {
        await login(formData.get('email'), formData.get('password'));
        return { success: true };
      } catch (error) {
        return { success: false, error: String(error) };
      }
    },
    { success: false }
  );

  return (
    <form action={action}>
      <input type="email" name="email" />
      <button type="submit">Login</button>
    </form>
  );
}
```

### Hooks Rules
```typescript
// ✅ GOOD: Proper hook dependencies
useEffect(() => {
  const timer = setInterval(() => {
    fetchData(userId);
  }, 5000);

  return () => clearInterval(timer);
}, [userId]); // userId in deps to track changes

// ✅ GOOD: useMemo for expensive calculations
const sortedInvoices = useMemo(
  () => invoices.sort((a, b) => a.date - b.date),
  [invoices]
);

// ❌ BAD: Missing dependencies (causes bugs)
useEffect(() => {
  fetchData(userId); // userId used but not in deps!
}, []);

// ❌ BAD: Inline function as dependency
useEffect(() => {
  const handler = () => {}; // NEW FUNCTION each render!
  window.addEventListener('resize', handler);
  return () => window.removeEventListener('resize', handler);
}, []); // Can't include handler in deps
```

---

## Database Query Patterns

### Always Use Parameterized Queries
```typescript
// ✅ GOOD: Parameterized (safe)
const result = await db.query(
  `INSERT INTO thai_invoices 
   (id, invoice_number, cust_code, user_id, created_at) 
   VALUES ($1, $2, $3, $4, NOW())`,
  [invoiceId, invoiceNumber, custCode, userId]
);

// ✅ GOOD: Using Zod for type safety
const insertInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  invoiceNumber: z.string().min(1).max(255),
  custCode: z.string().min(1).max(255),
  userId: z.string().uuid()
});

const params = insertInvoiceSchema.parse({
  invoiceId, 
  invoiceNumber, 
  custCode, 
  userId
});

// ❌ WRONG: String interpolation (SQL injection!)
const result = await db.query(
  `INSERT INTO thai_invoices 
   VALUES ('${invoiceId}', '${invoiceNumber}', '${custCode}')`
);

// ❌ WRONG: No validation
const result = await db.query(
  `INSERT INTO thai_invoices VALUES ($1, $2, $3)`,
  [unknownData1, unknownData2, unknownData3]
);
```

### Transaction Pattern
```typescript
// ✅ GOOD: Atomic operations
async function processInvoice(data: ThaiInvoiceData): Promise<Result<string>> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    
    // Insert invoice
    const invoiceResult = await client.query(
      `INSERT INTO thai_invoices (...) VALUES (...) RETURNING id`,
      [...]
    );
    const invoiceId = invoiceResult.rows[0].id;

    // Insert items (uses invoice ID)
    for (const item of data.item_descriptions) {
      await client.query(
        `INSERT INTO invoice_items (...) VALUES (...)`,
        [invoiceId, ...]
      );
    }

    // Log token usage
    await client.query(
      `INSERT INTO api_token_usage (...) VALUES (...)`,
      [...]
    );

    await client.query('COMMIT');
    return { success: true, data: invoiceId };
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction failed', { error });
    return { 
      success: false, 
      error: 'Failed to process invoice' 
    };
  } finally {
    client.release();
  }
}
```

---

## Logging Standards

### Structured Logging
```typescript
// ✅ GOOD: Structured JSON logging
logger.info('Invoice processed', {
  invoiceId: '123',
  invoiceNumber: 'INV001',
  userId: 'user-456',
  tokensUsed: 1600,
  processingTimeMs: 2341,
  success: true
});

logger.error('Invoice extraction failed', {
  invoiceId: '123',
  errorType: 'VALIDATION_ERROR',
  failedFields: ['invoice_number', 'cust_code'],
  userId: 'user-456',
  stack: error.stack
});

// ❌ BAD: Unstructured logging
console.log('Processing invoice 123'); // No context
console.error(error); // Throws error object
logger.warn(`User ${userId} uploaded file`); // Inconsistent format
```

### What to Log
- ✅ API requests (method, path, status, response time)
- ✅ Errors (type, message, context, stack trace)
- ✅ Security events (auth failures, permission denials)
- ✅ Performance metrics (query time, extraction time)
- ✅ Data changes (what changed, who changed it, when)

### What NOT to Log
- ❌ Passwords or API keys
- ❌ Personal information (email, phone in plain text)
- ❌ Credit card numbers
- ❌ Full request/response bodies (log headers + sample)
- ❌ Debug spam (remove before commit)

---

## Performance Standards

### Response Time Targets
- API endpoints: < 500ms p95
- Database queries: < 100ms p95
- File upload processing: < 5s for 10MB file
- WebSocket message delivery: < 100ms

### Bundle Size Targets
- Main bundle: < 100KB gzipped
- Each route chunk: < 50KB gzipped
- Total initial load: < 200KB

### Monitoring Code
```typescript
// ✅ GOOD: Track performance metrics
async function extractInvoice(buffer: Buffer) {
  const startTime = performance.now();
  try {
    const result = await geminiService.extract(buffer);
    const duration = performance.now() - startTime;
    
    logger.info('Extraction completed', {
      duration,
      tokensUsed: result.tokensUsed.total,
      success: true
    });

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    logger.error('Extraction failed', {
      duration,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
```

---

## Testing Patterns

### Unit Test Structure
```typescript
// ✅ GOOD: Clear test structure with Vitest
describe('ThaiInvoiceExtractor', () => {
  describe('validateInvoiceNumber', () => {
    it('should accept valid invoice number', () => {
      const result = validator.validateInvoiceNumber('INV001');
      expect(result.success).toBe(true);
      expect(result.data).toBe('INV001');
    });

    it('should reject empty invoice number', () => {
      const result = validator.validateInvoiceNumber('');
      expect(result.success).toBe(false);
      expect(result.error).toContain('required');
    });

    it('should reject invoice number > 255 chars', () => {
      const longString = 'a'.repeat(256);
      const result = validator.validateInvoiceNumber(longString);
      expect(result.success).toBe(false);
    });
  });
});

// ❌ BAD: Vague test names
it('should work', () => {
  // what should work?
  const result = validator.validate('test');
  expect(result).toBeTruthy();
});
```

---

## Security Standards

### Input Validation
```typescript
// ✅ GOOD: Zod validation on all inputs
const uploadSchema = z.object({
  files: z.array(z.instanceof(File))
    .min(1, 'At least 1 file required')
    .max(10, 'Maximum 10 files'),
  invoiceNumber: z.string()
    .min(1, 'Invoice number required')
    .max(255, 'Too long'),
  custCode: z.string()
    .min(1, 'Customer code required')
    .max(255, 'Too long')
});

// ❌ BAD: No validation
const data = req.body; // Could be anything!
db.query(`INSERT INTO invoices (invoice_number) VALUES (${data.invoiceNumber})`);
```

### Authentication
```typescript
// ✅ GOOD: JWT with short expiry
const token = jwt.sign(
  { userId, email, role },
  privateKey,
  { 
    algorithm: 'RS256',
    expiresIn: '15m'  // Short expiry!
  }
);

// ❌ BAD: Long-lived tokens
const token = jwt.sign(userId, secret);  // No expiry!
```

---

This is the foundation. Reference this file in all development work.
