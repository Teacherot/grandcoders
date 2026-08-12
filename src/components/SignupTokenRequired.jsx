import React, { useEffect, useState } from "react";
import AuthLayout from "@/components/AuthLayout";
import { Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";

// Token requirement removed:
// If user is signed in, provision agent account (if missing) and continue.
export default function SignupTokenRequired() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setError("");
      setLoading(true);

      try {
        if (!supabase) throw new Error("Supabase is not configured");

        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;

        const user = authData?.user;
        if (!user?.email) throw new Error("You must be signed in first.");

        const { data: existing, error: existingError } = await supabase
          .from("agents")
          .select("id")
          .eq("email", user.email)
          .limit(1);

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

        // Clean up any leftover token cache from older builds
        try {
          sessionStorage.removeItem("pending_signup_token");
        } catch {
          // ignore
        }

        // Continue app flow
        window.location.reload();
      } catch (err) {
        setError(err.message || "Unable to finish account setup.");
        setLoading(false);
      }
    };

    run();
  }, []);

  return (
    <AuthLayout
      icon={error ? Loader2 : CheckCircle2}
      title={error ? "Setup failed" : "Finishing account setup"}
      subtitle={
        error
          ? "We couldn't finish creating your account."
          : "Please wait a moment while we prepare your account."
      }
    >
      <div className="space-y-3">
        {loading && !error && (
          <div className="flex items-center text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Creating your account...
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">
            {error}
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
