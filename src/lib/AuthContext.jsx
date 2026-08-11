import React, { createContext, useState, useContext, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';

const AuthContext = createContext();

const buildUserFromSession = async (sessionUser) => {
  if (!sessionUser?.email) return null;

  let profile = null;
  try {
    if (supabase) {
      const { data: byId, error: byIdError } = await supabase.from('agents').select('*').eq('id', sessionUser.id).limit(1);
      if (!byIdError && byId?.[0]) {
        profile = byId[0];
      } else {
        // Legacy fallback: older rows may have non-auth IDs and match on email.
        const { data: byEmail, error: byEmailError } = await supabase.from('agents').select('*').eq('email', sessionUser.email).limit(1);
        if (!byEmailError && byEmail?.[0]) {
          profile = byEmail[0];
        }
      }
    }
  } catch (error) {
    console.warn('Unable to load agent profile for auth user', error);
  }

  return {
    id: sessionUser.id,
    email: sessionUser.email,
    full_name: profile?.full_name || sessionUser.user_metadata?.full_name || sessionUser.email.split('@')[0],
    role: profile?.role || sessionUser.user_metadata?.role || 'agent',
    store_name: profile?.store_name || '',
    commission_rate: profile?.commission_rate || 10,
    requiresSignupToken: !profile,
    profile,
  };
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const syncAuthState = async () => {
    if (!supabase) {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthChecked(true);
      setAuthError({ type: 'auth_required', message: 'Supabase is not configured' });
      setUser(null);
      setIsAuthenticated(false);
      setAppPublicSettings({ id: 'demo', public_settings: {} });
      return;
    }

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        const nextUser = await buildUserFromSession(session.user);
        setUser(nextUser);
        setIsAuthenticated(true);
        if (nextUser?.requiresSignupToken) {
          setAuthError({ type: 'signup_token_required', message: 'Sign-up token is required to finish account setup.' });
        } else {
          setAuthError(null);
        }
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setAuthError(null);
      }
    } catch (error) {
      console.error('Auth sync failed', error);
      setAuthError({ type: 'auth_required', message: error?.message || 'Unable to load auth state' });
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setIsLoadingAuth(false);
      setIsLoadingPublicSettings(false);
      setAuthChecked(true);
      setAppPublicSettings({ id: 'live', public_settings: {} });
    }
  };

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      await syncAuthState();
      if (!mounted || !supabase) return;

      const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          const nextUser = await buildUserFromSession(session.user);
          setUser(nextUser);
          setIsAuthenticated(true);
          if (nextUser?.requiresSignupToken) {
            setAuthError({ type: 'signup_token_required', message: 'Sign-up token is required to finish account setup.' });
          } else {
            setAuthError(null);
          }
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setAuthError(null);
        }
        setIsLoadingAuth(false);
        setAuthChecked(true);
      });

      return authListener?.subscription?.unsubscribe;
    };

    let unsubscribe = null;
    initialize().then((cleanup) => {
      unsubscribe = cleanup;
    });

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  const checkAppState = async () => {
    await syncAuthState();
  };

  const checkUserAuth = async () => {
    await syncAuthState();
  };

  const login = async (email, password) => {
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const message = error?.message || 'Unable to sign in';
      if (message.includes('email_not_confirmed') || message.includes('Email not confirmed')) {
        throw new Error('Please confirm your email before signing in. Check your inbox for the confirmation link.');
      }
      throw new Error(message);
    }

    const nextUser = await buildUserFromSession(data?.user);
    setUser(nextUser);
    setIsAuthenticated(true);
    setAuthChecked(true);
    if (nextUser?.requiresSignupToken) {
      setAuthError({ type: 'signup_token_required', message: 'Sign-up token is required to finish account setup.' });
    } else {
      setAuthError(null);
    }
    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    return data;
  };

  const register = async (email, password) => {
    if (!supabase) {
      throw new Error('Supabase is not configured');
    }

    setIsLoadingAuth(true);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      const message = error?.message || 'Unable to create account';
      if (message.includes('email_not_confirmed') || message.includes('Email not confirmed')) {
        throw new Error('Please confirm your email before signing in. Check your inbox for the confirmation link.');
      }
      throw new Error(message);
    }

    if (data?.user) {
      const nextUser = await buildUserFromSession(data.user);
      setUser(nextUser);
      setIsAuthenticated(Boolean(data.session));
      setAuthChecked(true);
      if (nextUser?.requiresSignupToken) {
        setAuthError({ type: 'signup_token_required', message: 'Sign-up token is required to finish account setup.' });
      } else {
        setAuthError(null);
      }
    }

    setIsLoadingAuth(false);
    setIsLoadingPublicSettings(false);
    return data;
  };

  const logout = async (shouldRedirect = true) => {
    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      console.error('Auth logout failed', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthChecked(true);
      setAuthError(null);
      if (shouldRedirect) {
        const target = '/login';
        window.location.replace(target);
      }
    }
  };

  const navigateToLogin = () => {
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      login,
      register,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
