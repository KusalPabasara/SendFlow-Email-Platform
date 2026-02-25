# SendFlow - Email Platform

A modern, fast, and secure web application to send personalized emails with unique certificate attachments, leveraging Gmail SMTP without retaining sensitive user passwords.

## Tech Stack
- **Frontend:** Vite, React, Vanilla CSS (Glassmorphism design)
- **Backend:** Node.js, Express, Multer, Nodemailer

## Setup Instructions
1. Clone the repository.
2. Install dependencies for the root, backend, and frontend:
   ```bash
   npm install
   cd backend && npm install
   cd ../frontend && npm install
   ```
3. Run the application concurrently (Frontend on 5173, Backend on 3001):
   ```bash
   npm start
   ```

## Usage
- The platform uses "App Passwords" for secure SMTP transmission. 
- Ensure your CSV file has exactly `name` and `email` columns.
- Ensure uploaded PDF certificate basenames perfectly match either the recipient's name or email from the CSV.

## Deployment
This project is configured for automated CI/CD via GitHub Actions. Any push to the `main` branch will automatically deploy the application to the DigitalOcean VPS.
