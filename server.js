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

app.use(
  "/api/chat",
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false
  })
);

app.post("/api/chat", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        ok: false,
        error: "AI service is not configured."
      });
    }

    const messages = req.body?.messages;

    if (
      !Array.isArray(messages) ||
      messages.length < 1 ||
      messages.length > 10
    ) {
      return res.status(400).json({
        ok: false,
        error: "Please send 1 to 10 messages."
      });
    }

    const contents = [];

    for (const m of messages) {
      if (
        !m ||
        !["user", "model"].includes(m.role) ||
        typeof m.text !== "string" ||
        !m.text.trim() ||
        m.text.length > 2000
      ) {
        return res.status(400).json({
          ok: false,
          error: "Invalid message."
        });
      }

      if (
        contents.length &&
        contents[contents.length - 1].role === m.role
      ) {
        return res.status(400).json({
          ok: false,
          error: "Messages must alternate roles."
        });
      }

      contents.push({
        role: m.role,
        parts: [{ text: m.text.trim() }]
      });
    }

    if (contents[contents.length - 1].role !== "user") {
      return res.status(400).json({
        ok: false,
        error: "Last message must be from the user."
      });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text:
                "You are the AI assistant for SkyLuxe Real Estate. " +
                "Help customers with buying, selling, renting, budgets " +
                "and property locations. Ask questions to understand " +
                "their requirements. Never invent property listings, " +
                "prices or availability. If details are unknown, say " +
                "the SkyLuxe team must confirm them. For human assistance, " +
                "provide realestateskyluxe@gmail.com or WhatsApp +91 9608934272. " +
                "Reply in the language used by the customer."
            }]
          },
          contents,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 500
          }
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("Gemini error:", response.status, details);

      return res.status(502).json({
        ok: false,
        error: "AI is temporarily unavailable."
      });
    }

    const data = await response.json();
    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        ok: false,
        error: "No AI response received."
      });
    }

    return res.json({ ok: true, reply });
  } catch (error) {
    console.error("Chat error:", error.message);

    return res.status(502).json({
      ok: false,
      error: "Could not connect to AI."
    });
  }
});
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
