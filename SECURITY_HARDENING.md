# Security Hardening Guide

This document outlines the security improvements made to BLE2WebSvc and provides guidance on secure deployment.

## Security Fixes Applied

### 1. Timing Attack Prevention ✓
**Issue**: Token comparisons were vulnerable to timing attacks.
**Fix**: Implemented `crypto.timingSafeEqual()` for secure token and API key verification.

**Files Modified**:
- `mcp-server.js`: MCP token authentication
- `server.js`: API key authentication

### 2. Information Disclosure Prevention ✓
**Issue**: API error responses leaked internal error details to clients.
**Fix**: Implemented safe error message mapping that logs detailed errors internally while returning generic messages to clients.

**Security Helpers Added**:
- `SecurityHelpers.getSafeErrorMessage()`: Maps error messages to client-safe responses
- Error details are logged with `console.error` but not exposed in API responses

### 3. Input Validation ✓
**Issue**: Device IDs and UUIDs were not validated, potentially allowing injection attacks.
**Fix**: Added robust input validation helpers.

**Validators Added**:
- `SecurityHelpers.isValidDeviceId()`: Validates device ID format (alphanumeric, `-`, `_`, `:`)
- `SecurityHelpers.isValidUUID()`: Validates standard UUID/short UUID formats

### 4. CORS Security ✓
**Issue**: CORS was configured to allow requests from any origin (`*`), creating cross-origin vulnerabilities.
**Fix**: Restricted CORS to specific origins.

**Configuration**:
- Development (default): `http://localhost:3000`
- Production: Set via `CORS_ORIGIN` environment variable
- To allow requests from any origin in production (not recommended): `CORS_ORIGIN=*`

### 5. Rate Limiting ✓
**Issue**: Rate limiting was only applied to `/ble` routes, leaving other endpoints unprotected.
**Fix**: Applied global rate limiting to all routes.

**Configuration**:
- Global limiter: 240 requests per minute (2x the `/ble` limit)
- API limiter: 120 requests per minute for `/ble` routes
- Configure via environment variables:
  - `RATE_LIMIT_WINDOW_MS`: Time window in milliseconds (default: 60000)
  - `RATE_LIMIT_MAX`: Max requests per window (default: 120)

### 6. Static File Serving Control ✓
**Issue**: Static files could potentially expose sensitive information.
**Fix**: Made static file serving optional and configurable.

**Configuration**:
- Environment variable: `SERVE_STATIC` (default: enabled)
- Set to `SERVE_STATIC=false` to disable static file serving
- When enabled, security headers are applied via Helmet

---

## Deployment Security Checklist

### Required for Production

- [ ] Set `NODE_ENV=production`
- [ ] Set `CORS_ORIGIN` to your frontend domain(s)
  ```bash
  export CORS_ORIGIN=https://myapp.example.com
  ```
- [ ] Set strong `MCP_TOKEN` for MCP server authentication
  ```bash
  export MCP_TOKEN=$(openssl rand -hex 32)
  ```
- [ ] Set `API_KEY` for REST API authentication (optional but recommended)
  ```bash
  export API_KEY=$(openssl rand -hex 32)
  ```
- [ ] Enable HTTPS/TLS at the reverse proxy or load balancer
- [ ] Use a reverse proxy (nginx, Apache, HAProxy) with:
  - SSL/TLS termination
  - Rate limiting and DDoS protection
  - HSTS headers
- [ ] Restrict firewall access to trusted IP addresses

### Recommended for Production

- [ ] Enable API_KEY authentication for all REST API access
  - Set `x-api-key` header with each request
- [ ] Use HTTPS everywhere (HTTP should redirect to HTTPS)
- [ ] Set `SERVE_STATIC=false` if not serving web UI
- [ ] Monitor logs for suspicious activity
- [ ] Regularly update dependencies (`npm audit fix`)
- [ ] Use a containerized deployment (Docker) for isolation

### Environment Variables

**Authentication & Security**:
```bash
MCP_TOKEN=<secure-random-token>              # Required for MCP authentication
API_KEY=<secure-random-key>                  # Optional for REST API authentication
CORS_ORIGIN=https://example.com              # Restrict to specific origin(s)
SERVE_STATIC=false                           # Disable if not needed
```

**Server Configuration**:
```bash
NODE_ENV=production                          # Must be set in production
PORT=8111                                    # REST API port
MCP_PORT=8123                                # MCP server port
```

**Rate Limiting**:
```bash
RATE_LIMIT_WINDOW_MS=60000                   # 1 minute window
RATE_LIMIT_MAX=120                           # 120 requests per window
```

---

## API Authentication

### MCP Server
The MCP server requires authentication if `MCP_TOKEN` is set:

```bash
# Send auth request first
{"type": "mcp/auth", "payload": {"token": "<MCP_TOKEN>"}}

# Then proceed with regular MCP requests
{"type": "mcp.ble.devices", "payload": {}}
```

### REST API
If `API_KEY` is set, include it in all requests:

```bash
# Option 1: Header
curl -H "x-api-key: <API_KEY>" http://localhost:8111/ble/devices

# Option 2: Query parameter
curl http://localhost:8111/ble/devices?api_key=<API_KEY>
```

---

## Security Headers Configuration

To further enhance security, add these headers at your reverse proxy or load balancer:

```nginx
# Example nginx configuration
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Content-Security-Policy "default-src 'self'" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

## Logging & Monitoring

**Security Events to Monitor**:
1. Failed authentication attempts (MCP_TOKEN or API_KEY mismatches)
2. Invalid input parameters (UUID/device ID validation failures)
3. Rate limiting triggers (401 errors)
4. Unhandled exceptions (500 errors)

**Log Format**:
- Detailed errors are logged to console (stderr)
- API errors are logged with context but safe messages are returned to clients
- Use a log aggregation service (ELK, Datadog, CloudWatch) for production

---

## Vulnerability Scanning

### Node.js Dependencies
Regularly check for vulnerable dependencies:

```bash
npm audit
npm audit fix
```

Update to the latest versions:

```bash
npm update
```

---

## Recent Changes

- **Added timing-safe token comparison** - prevents timing attacks on authentication
- **Restricted error messages** - internal details no longer exposed to clients
- **Added input validation** - device IDs and UUIDs are validated
- **Fixed CORS configuration** - no longer allows all origins by default
- **Applied rate limiting globally** - all endpoints are now rate limited
- **Made static serving configurable** - can be disabled for API-only deployments

---

## Testing Security

### Test Token Comparison (Timing)
```javascript
// Timing attacks are now prevented
const crypto = require('crypto');
const token1 = "secret123";
const token2 = "secret456";
crypto.timingSafeEqual(Buffer.from(token1), Buffer.from(token2)); // false
```

### Test Input Validation
```bash
# Invalid device ID (should return 400)
curl http://localhost:8111/ble/devices/../../etc%2fpasswd/connect

# Invalid UUID (should return 400)
curl http://localhost:8111/ble/devices/valid-id/services/invalid-uuid/characteristics
```

### Test CORS
```bash
# From different origin (should be blocked in production)
curl -H "Origin: https://evil.com" http://localhost:8111/ble/devices
```

---

## References

- [OWASP Security Headers](https://owasp.org/www-project-secure-headers/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Timing Attacks](https://codahale.com/a-lesson-in-timing-attacks/)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)

---

## Support

For security issues, please follow the vulnerability disclosure process in [SECURITY.md](./SECURITY.md).
