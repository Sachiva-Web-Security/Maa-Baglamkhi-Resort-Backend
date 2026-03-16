# Backend – College Admission Portal

## Setup

1. **Install dependencies**

   ```bash
   cd backend
   npm install
   ```

2. **Configure environment variables**

   Create a `.env` file in the `backend` folder with at least:

   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_mysql_user
   DB_PASSWORD=your_mysql_password
   DB_NAME=college_admission

   PORT=4000

   JWT_SECRET=your_jwt_secret
   JWT_EXPIRES_IN=1d

   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your_gmail_address@gmail.com
   SMTP_PASS=your_gmail_app_password
   SMTP_FROM_EMAIL="College Admission Portal <your_gmail_address@gmail.com>"

   CLIENT_URL=http://localhost:5173
   ```

3. **Run DB schema (Phase 1)**

   Import `db-schema-phase1.sql` into your MySQL server.

4. **Run the server**

   ```bash
   npm run dev
   ```

