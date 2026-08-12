import React, { useState } from "react";
import { signUpAgent, signInAgent, getCurrentAgent, signOut } from "@/lib/auth";

export default function AuthTester() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [agent, setAgent] = useState(null);

  const handleSignUp = async () => {
    try {
      await signUpAgent(email, password, fullName);
      setMessage("Signup successful. Check email if confirmation is enabled.");
    } catch (error) {
      setMessage(error?.message || "Signup failed.");
    }
  };

  const handleSignIn = async () => {
    try {
      await signInAgent(email, password);
      const row = await getCurrentAgent();
      setAgent(row);
      setMessage("Signed in and agent loaded.");
    } catch (error) {
      setMessage(error?.message || "Sign in failed.");
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setAgent(null);
      setMessage("Signed out.");
    } catch (error) {
      setMessage(error?.message || "Sign out failed.");
    }
  };

  return (
    <div style={{ maxWidth: 420, margin: "40px auto", display: "grid", gap: 8 }}>
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>Auth Tester</h1>
      <input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />

      <button onClick={handleSignUp}>Sign Up</button>
      <button onClick={handleSignIn}>Sign In</button>
      <button onClick={handleSignOut}>Sign Out</button>

      <p>{message}</p>
      {agent && <pre>{JSON.stringify(agent, null, 2)}</pre>}
    </div>
  );
}
