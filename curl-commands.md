# Backend API Test Commands

Open a NEW terminal window and run these commands one by one to test your API on port 8080.

## 1. Auth APIs

### Register a User
```bash
curl -X POST http://127.0.0.1:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"student2@example.com","password":"password123"}'
```
*Note: Check your email for the OTP.*

### Verify OTP
```bash
curl -X POST http://127.0.0.1:8080/api/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"student2@example.com","otp":"123456"}'
```
*Replace `123456` with the actual OTP from your email.*

### Login
```bash
curl -X POST http://127.0.0.1:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"student2@example.com","password":"password123"}'
```
*Note: Copy the `token` from the response. You will need it for the next commands.*

---

## 2. Using Protected APIs
For the commands below, replace `YOUR_TOKEN_HERE` with the token string you got from logging in.

### [Admin] Create College Account
```bash
curl -X POST http://127.0.0.1:8080/api/admin/create-college-account \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwicm9sZSI6InN0dWRlbnQiLCJlbWFpbCI6InN0dWRlbnQyQGV4YW1wbGUuY29tIiwiaWF0IjoxNzcyMDQ5MzYyLCJleHAiOjE3NzIxMzU3NjJ9.QWyllz8zVHc4p2GtVx7I_YLOhPLc_8x4uS5b6UJR5QI" \
  -d '{"name":"Admin User","email":"college1@example.com","college_name":"Example University"}'
```

### [Admin] Get Pending Colleges
```bash
curl -X GET "http://127.0.0.1:8080/api/admin/colleges?status=pending" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### [Admin] Approve a College
```bash
curl -X PUT http://127.0.0.1:8080/api/admin/approve-college/1 \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### [Admin] View All Students
```bash
curl -X GET http://127.0.0.1:8080/api/admin/students \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## 3. College APIs (Requires a College token)
*To test these, you must login as the newly created College user, get their token, and replace `YOUR_COLLEGE_TOKEN_HERE` with it.*

### [College] View Profile
```bash
curl -X GET http://127.0.0.1:8080/api/college/profile \
  -H "Authorization: Bearer YOUR_COLLEGE_TOKEN_HERE"
```

### [College] Update Profile
```bash
curl -X PUT http://127.0.0.1:8080/api/college/profile \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_COLLEGE_TOKEN_HERE" \
  -d '{"description":"A premier university","location":"New York"}'
```

---

## 4. Student APIs

### [Public] View Approved Colleges
```bash
curl -X GET http://127.0.0.1:8080/api/colleges
```

### [Student] Apply to a College
```bash
curl -X POST http://127.0.0.1:8080/api/student/applications \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -d '{"college_id": 1}'
```

### [Student] View My Applications
```bash
curl -X GET http://127.0.0.1:8080/api/student/applications \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
