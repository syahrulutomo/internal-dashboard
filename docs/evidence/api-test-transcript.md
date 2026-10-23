# API test transcript

Real `curl` requests and responses captured against the running backend
(`http://localhost:8080`) with the seeded accounts (`cs@test.com` / `operation@test.com`,
password `password`) on 2026-10-23T09:39:03Z.

Covers all six spec endpoints plus the two negative paths that prove the
security boundary: a tokenless call (401) and a `cs` export attempt (403, RBAC).

### 1. GET /health — public liveness probe

```bash
$ curl http://localhost:8080/health
```

```http
HTTP 200
```

```json
{
    "status": "ok",
    "time": "2026-10-23T09:39:03.071937Z"
}
```

### 2. POST /dashboard/v1/auth/login — cs account

```bash
$ curl -X POST http://localhost:8080/dashboard/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"cs@test.com","password":"password"}'
```

```http
HTTP 200
```

```json
{
    "email": "cs@test.com",
    "role": "cs",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6ImNzQHRlc3QuY29tIiwiZXhwIjoxNzkyODM0NzQzLCJpYXQiOjE3OTI3NDgzNDMsInJvbGUiOiJjcyIsInN1YiI6IjEifQ.r8uWXrFqNgHPQdquqbS-VzUZepdCaG1CRJ0-NGCXDSY"
}
```

### 3. POST /dashboard/v1/auth/login — operation account

```bash
$ curl -X POST http://localhost:8080/dashboard/v1/auth/login -H 'Content-Type: application/json' -d '{"email":"operation@test.com","password":"password"}'
```

```http
HTTP 200
```

```json
{
    "email": "operation@test.com",
    "role": "operation",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJlbWFpbCI6Im9wZXJhdGlvbkB0ZXN0LmNvbSIsImV4cCI6MTc5MjgzNDc0MywiaWF0IjoxNzkyNzQ4MzQzLCJyb2xlIjoib3BlcmF0aW9uIiwic3ViIjoiMiJ9.n-VTv2l5FIM1L6yFjoEyIVksldP4nq_6X86USXoorv0"
}
```

### 4. GET /dashboard/v1/auth/me — identity from the bearer token (cs)

```bash
$ curl http://localhost:8080/dashboard/v1/auth/me -H 'Authorization: Bearer $TOKEN_CS'
```

```http
HTTP 200
```

```json
{
    "email": "cs@test.com",
    "role": "cs"
}
```

### 5. GET /dashboard/v1/payments — filtered + paginated (cs)

```bash
$ curl 'http://localhost:8080/dashboard/v1/payments?status=completed&page=1&per_page=3' -H 'Authorization: Bearer $TOKEN_CS'
```

```http
HTTP 200
```

```json
{
    "meta": {
        "page": 1,
        "per_page": 3,
        "total": 30,
        "total_pages": 10
    },
    "payments": [
        {
            "amount": "50.00",
            "created_at": "2026-10-21T06:13:39.894401Z",
            "id": "PAY-1001",
            "merchant": "Acme Corp",
            "status": "completed"
        },
        {
            "amount": "420.13",
            "created_at": "2026-10-20T17:13:39.894401Z",
            "id": "PAY-1002",
            "merchant": "Globex",
            "status": "completed"
        },
        {
            "amount": "790.26",
            "created_at": "2026-10-20T04:13:39.894401Z",
            "id": "PAY-1003",
            "merchant": "Soylent Co",
            "status": "completed"
        }
    ]
}
```

### 6. GET /dashboard/v1/payments/summary — aggregates (operation)

```bash
$ curl http://localhost:8080/dashboard/v1/payments/summary -H 'Authorization: Bearer $TOKEN_OP'
```

```http
HTTP 200
```

```json
{
    "amount_by_status": {
        "completed": "69824.09",
        "failed": "18703.10",
        "processing": "24356.45"
    },
    "completed": 30,
    "failed": 7,
    "processing": 11,
    "total": 48,
    "total_amount": "112883.64"
}
```

### 7. GET /dashboard/v1/payments/export — operation role (allowed)

```bash
$ curl -D - 'http://localhost:8080/dashboard/v1/payments/export?status=completed' -H 'Authorization: Bearer $TOKEN_OP'
```

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-Id: e1befb87-4f07-4d4e-b7cf-c99b1a28ae61
```

The endpoint returns the **full** filtered result set as JSON (here `per_page: 100`,
so all 30 `completed` rows in one page); the dashboard converts it to a downloadable
CSV client-side. Response body (truncated to the first 3 of 30 rows):

```json
{
    "meta": {
        "page": 1,
        "per_page": 100,
        "total": 30,
        "total_pages": 1
    },
    "payments": [
        {
            "amount": "50.00",
            "created_at": "2026-10-21T06:13:39.894401Z",
            "id": "PAY-1001",
            "merchant": "Acme Corp",
            "status": "completed"
        },
        {
            "amount": "420.13",
            "created_at": "2026-10-20T17:13:39.894401Z",
            "id": "PAY-1002",
            "merchant": "Globex",
            "status": "completed"
        },
        {
            "amount": "790.26",
            "created_at": "2026-10-20T04:13:39.894401Z",
            "id": "PAY-1003",
            "merchant": "Soylent Co",
            "status": "completed"
        },
        "\u2026 27 more rows \u2026"
    ]
}
```

### 8. GET /dashboard/v1/payments/export — cs role (403 Forbidden, RBAC boundary)

```bash
$ curl http://localhost:8080/dashboard/v1/payments/export -H 'Authorization: Bearer $TOKEN_CS'
```

```http
HTTP 403
```

```json
{
    "code": 403,
    "message": "exporting payments requires the operation role"
}
```

### 9. GET /dashboard/v1/payments — no token (401 Unauthorized)

```bash
$ curl http://localhost:8080/dashboard/v1/payments   # no Authorization header
```

```http
HTTP 401
```

```json
{
    "code": 401,
    "message": "security requirements failed: missing authorization header"
}
```
