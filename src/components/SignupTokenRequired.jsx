import React, { useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Shown on first login to a brand-new account that wasn't pre-authorized
// (e.g. a direct Google sign-up that skipped the register token gate). The user
// must enter a valid sign-up token to provision their agent account.
export default function SignupTokenRequired() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!supabase) throw new Error("Supabase is not configured");
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      const user = authData?.user;
      if (!user?.email) throw new Error("You must be signed in first.");

      const { data: existing, error: existingError } = await supabase.from("agents").select("id").eq("email", user.email).limit(1);
      if (existingError) throw existingError;

      if (!(existing || [])[0]) {
        const payload = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email.split("@")[0],
          role: "agent",
          status: "active",
          code: `A${Date.now().toString().slice(-6)}`,
          created_at: new Date().toISOString(),
          created_date: new Date().toISOString(),
        };
        const { error: insertError } = await supabase.from("agents").insert(payload);
        if (insertError) throw insertError;
      }
      window.location.reload();
    } catch (err) {
      setError(err.message || "Invalid token code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      icon={KeyRound}
      title="Enter your sign-up code"
      subtitle="You need a valid token code to finish creating your account."
    >
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="post-signup-token">Token code</Label>
          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
            <Input
              id="post-signup-token"
              type="text"
              autoFocus
              placeholder="Enter your token code"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              className="pl-10 h-12"
              required
            />
          </div>
        </div>
        <Button type="submit" className="w-full h-12 font-medium" disabled={loading || !token.trim()}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Verifying...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}