import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.post("/api/chat", async (req, res) => {
  try {
    const { messages, extractedText } = req.body;

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful language-learning assistant. Explain clearly and concisely.",
          },
          {
            role: "user",
            content: `Selected text:\n${extractedText}`,
          },
          ...messages,
        ],
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    console.log("DeepSeek status:", response.status);
    console.log("DeepSeek response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
    return res.status(response.status).json({
        error: data.error?.message || "DeepSeek API error",
    });
    }

    res.json({
    reply: data.choices?.[0]?.message?.content || "No response.",
    });
    
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "AI request failed." });
  }
});

app.listen(3001, () => {
  console.log("AI server running on http://localhost:3001");
});