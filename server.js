import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "20kb" }));
app.use(express.static("public"));

app.use(
  "/api/enquiry",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 8,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/enquiry", async (req, res) => {
  const {
    name,
    phone,
    email = "",
    interest,
    message = "",
    website = ""
  } = req.body || {};

  if (website) return res.json({ ok: true });

  if (!name || !phone || !interest) {
    return res.status(400).json({
      ok: false,
      error: "Name, phone and enquiry type are required."
    });
  }

  if ([name, phone, email, interest, message].some(
    value => String(value).length > 4000
  )) {
    return res.status(400).json({
      ok: false,
      error: "A field is too long."
    });
  }

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "Email service is not configured."
    });
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "SkyLuxe Website <onboarding@resend.dev>",
        to: ["realestateskyluxe@gmail.com"],
        subject: `New SkyLuxe enquiry: ${String(interest).slice(0, 100)}`,
        text:
          `New SkyLuxe enquiry\n\n` +
          `Name: ${name}\n` +
          `Phone: ${phone}\n` +
          `Email: ${email || "Not provided"}\n` +
          `Interest: ${interest}\n` +
          `Message: ${message || "Not provided"}`
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("Resend error:", error);
      return res.status(502).json({
        ok: false,
        error: "Email delivery failed. Check email service settings."
      });
    }

    return res.json({ ok: true });
  } catch (error) {
    console.error("Email request failed:", error.message);
    return res.status(502).json({
      ok: false,
      error: "Could not send email."
    });
  }
});

app.listen(Number(process.env.PORT || 3000), () => {
  console.log("SkyLuxe server running");
});
