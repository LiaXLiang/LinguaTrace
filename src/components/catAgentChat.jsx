import React, { useState } from "react";
import ReactMarkdown from "react-markdown"

export default function CatAgentChat({ open, onClose, extractedText, setExtractedText, }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Meow～ My name is Oreo. How can I help you today?",
    },
  ]);

  const [input, setInput] = useState("");

    async function sendMessage() {
    const cleanInput = input.trim();
    if (!cleanInput) return;

    const nextMessages = [
        ...messages,
        { role: "user", content: cleanInput },
    ];

    setMessages(nextMessages);
    setInput("");

    try {
        const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/chat`,
        {
            method: "POST",
            headers: {
            "Content-Type": "application/json",
            },
            body: JSON.stringify({
            extractedText,
            messages: nextMessages.map((message) => ({
                role: message.role,
                content: message.content,
            })),
            }),
        }
        );

        const data = await response.json();

        if (!response.ok) {
        throw new Error(data.error || "AI request failed");
        }

        setMessages((prev) => [
        ...prev,
        {
            role: "assistant",
            content: data.reply || "Meow~ Sorry, I couldn't think of a reply right now.",
        },
        ]);
        
    } catch (error) {
        setMessages((prev) => [
        ...prev,
        {
            role: "assistant",
            content: "Meow~ I can't reach my AI brain right now. Please make sure the server is running.",
        },
        ]);
    }
    }

  return (
    <div className={open ? "cat-agent-overlay open" : "cat-agent-overlay"}>
    <div className="cat-agent-panel">
    
        <div className="cat-agent-avatar">
            <img src={`${import.meta.env.BASE_URL}cat-avatar.png`}
            alt="Cat Assistant" />
        </div>

        <div className="cat-agent-header">
            <button
            type="button"
            className="cat-close-button"
            onClick={onClose}
            >
            ×
            </button>
        </div>

        <div className="cat-context">
            <span>Selected text</span>
            <p>{extractedText}</p>
        </div>

        <div className="cat-messages">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "cat-message user-message"
                  : "cat-message assistant-message"
              }
            >
                <ReactMarkdown>
                    {message.content}
                </ReactMarkdown>
            </div>
          ))}
        </div>

        <div className="cat-input-row">
        <input
            className={input.trim() === "" ? "cat-input-empty" : "cat-input-typing"}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                sendMessage();
            }
            }}
            placeholder="Meow something..."
        />

        <button
            type="button"
            onClick={sendMessage}
        >
            Send
        </button>
        </div>
      </div>
    </div>
  );
}