# API Routes Documentation

This document describes the available routes and their functionality for auth middleware server that forwards requests to Azure Functions. This is supposed to emulate Azure Entra Id

## Base URL

- **Development**: `http://localhost:3000`
- **Production**: Depends on deployment configuration

## Environment Variables

- `PORT`: Server port (default: 3000)
- `JWT_SECRET`: Secret key for JWT token signing/verification
- `AZURE_GET_URL`: Azure Function URL for GET operations
- `AZURE_POST_URL`: Azure Function URL for POST operations

## Authentication

Most routes require JWT authentication via the `Authorization` header:

Authorization: Bearer token

## Routes

### 1. POST `/login`

**Purpose**: Generate JWT token for authentication

**Authentication**: None required

**Request Body**:

```json
{
  "username": "admin",
  "password": "password"
}
```

**Success Response** (200):

```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "username": "admin",
    "id": 1
  }
}
```

**Error Response** (401):

```json
{
  "error": "Invalid credentials"
}
```

---

### 2. GET `/get`

**Purpose**: Forward GET requests to Azure Function

**Authentication**: JWT token required

**Headers**:

```
Authorization: Bearer <jwt-token>
```

**Query Parameters**: Any query parameters will be forwarded to the Azure Function

**Success Response** (200):

```json
{
  "authenticated": true,
  "user": {
    "username": "admin",
    "id": 1
  },
  "azureResponse": {
    // Response from Azure Function
  },
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

**Error Responses**:

**401 - Missing Token**:

```json
{
  "error": "Access token required",
  "authenticated": false
}
```

**403 - Invalid Token**:

```json
{
  "error": "Invalid or expired token",
  "authenticated": false
}
```

**503 - Azure Function Unreachable**:

```json
{
  "error": "Unable to reach Azure Function",
  "authenticated": true,
  "user": {
    /* user info */
  },
  "message": "Service temporarily unavailable",
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

---

### 3. POST `/post`

**Purpose**: Forward POST requests to Azure Function

**Authentication**: JWT token required

**Headers**:

```
Authorization: Bearer <jwt-token>
Content-Type: application/json
```

**Request Body**: JSON object that will be forwarded to Azure Function

**Example Request**:

```json
{
  "data": "example data",
  "action": "create"
}
```

**Success Response** (200):

```json
{
  "authenticated": true,
  "user": {
    "username": "admin",
    "id": 1
  },
  "azureResponse": {
    // Response from Azure Function
  },
  "timestamp": "2025-10-17T21:00:00.000Z"
}
```

**Error Responses**: Same as GET `/get` route

---

### 4. 404 Handler

**Purpose**: Handle requests to non-existent routes

**Response** (404):

```json
{
  "error": "Route not found",
  "availableRoutes": ["/get", "/post", "/login"]
}
```

---

## Azure Function Integration

### Headers Forwarded to Azure Functions

The middleware automatically adds these headers when forwarding requests:

- `Content-Type: application/json`
- `Accept: application/json`
- `x-user-id: <user-id>`
- `x-username: <username>`

### Request Flow

1. Client sends request to middleware
2. Middleware validates JWT token
3. Request is forwarded to appropriate Azure Function
4. Azure Function response is wrapped and returned to client

### Timeout

- Azure Function requests have a 30-second timeout
- Network errors return a 503 status code

---

## Example Usage

### 1. Login to get token

```bash
curl -X POST http://localhost:3000/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

### 2. Use token for authenticated requests

```bash
# GET request
curl -X GET http://localhost:3000/get \
  -H "Authorization: Bearer <your-jwt-token>"

# POST request
curl -X POST http://localhost:3000/post \
  -H "Authorization: Bearer <your-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{"key": "value"}'
```

---

## Error Handling

The server includes comprehensive error handling:

- **JWT Authentication Errors**: 401/403 status codes
- **Azure Function Errors**: Forwards status code from Azure Function
- **Network Errors**: 503 status code
- **Server Errors**: 500 status code
- **Route Not Found**: 404 status code

All error responses include:

- Error message
- Authentication status
- User information (if authenticated)
- Timestamp

## TLDR

- The login credentials are hardcoded for testing (`admin`/`password`)
- JWT tokens expire in 1 hour
- All requests/responses are logged to console
- Azure Function URLs include authentication codes as query parameters
