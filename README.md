# SkyLuxe Real Estate integrated project

Includes `public/index.html` (website, AI assistant, contact form, WhatsApp) and `server.js` (first-party Gmail SMTP email backend).

## Deployment required
GitHub Pages alone cannot run this backend. Deploy this project to a Node.js host, set the environment variables from `.env.example` privately, and run `npm install` then `npm start`.

## Gmail SMTP
Sign in to realestateskyluxe@gmail.com, enable 2-Step Verification, create a Google App Password if available, and set it as private `SMTP_PASS` on the host. Never put credentials in HTML or commit them.

## AI
The page uses Puter.js generative AI. It requires HTTPS hosting (not file:// or content://) and may require authorization under Puter's current rules.
