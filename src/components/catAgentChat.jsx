import { useState } from "react";

export default function CatAgentChat({ open, onClose, extractedText }) {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Meow～我可以帮你解释这段文字、生成例句、翻译或做成闪卡。",
    },
  ]);

  const [input, setInput] = useState("");

  function sendMessage() {
    const cleanInput = input.trim();
    if (!cleanInput) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: cleanInput },
      {
        role: "assistant",
        content: `我会基于这段内容回答：${extractedText}`,
      },
    ]);

    setInput("");
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
              {message.content}
            </div>
          ))}
        </div>

        <div className="cat-input-row">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") sendMessage();
            }}
            placeholder="Ask anything about this text..."
          />

          <button onClick={sendMessage}>Send</button>
        </div>
      </div>
    </div>
  );
}