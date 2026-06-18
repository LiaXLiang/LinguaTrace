import { useState } from "react";
import { supabase } from "./supabaseClient";
import "./App.css";

export default function AuthPanel() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleAuth(event) {
    event.preventDefault();

    if (!email.trim() || !password.trim()) {
      setStatus("Please enter your email and password.");
      return;
    }

    setIsLoading(true);
    setStatus("");

    const { error } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({
            email: email.trim(),
            password,
          })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
          });

    if (error) {
      setStatus(error.message);
      setIsLoading(false);
      return;
    }

    if (mode === "signup") {
      setStatus(
        "Account created. Please check your email if confirmation is enabled."
      );
    }

    setIsLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="brand-mark">LT</span>
          <div>
            <h1>LinguaTrace</h1>
            <p>语迹 · Language Learning Notebook</p>
          </div>
        </div>

        <div className="auth-copy">
          <h2>{mode === "signin" ? "Welcome back" : "Create your account"}</h2>
          <p>
            Save your language notes, highlights, labels, and learning history
            under your own account.
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              setStatus("");
            }}
          >
            Sign in
          </button>

          <button
            type="button"
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              setStatus("");
            }}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleAuth}>
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          <button type="submit" disabled={isLoading}>
            {isLoading
              ? "Please wait..."
              : mode === "signin"
              ? "Sign in"
              : "Create account"}
          </button>
        </form>

        {status && <p className="auth-status">{status}</p>}
      </div>
    </div>
  );
}