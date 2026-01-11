import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { User, Session } from '@supabase/supabase-js';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST (before checking session)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state changed:', event, session?.user?.email);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // THEN check for existing session (this also handles hash fragment from email confirmation)
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Initial session check:', session?.user?.email);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signUp = async (email: string, password: string, restaurantName: string) => {
    const { data, error } = await supabase.auth.signUp({ 
      email, 
      password,
      options: {
        data: {
          restaurant_name: restaurantName
        }
      }
    });
    return { data, error };
  };

  const signOut = async () => {
    try {
      // Sign out from Supabase (local scope to avoid server errors)
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      
      // Always clear local state regardless of error
      setUser(null);
      setSession(null);
      
      // Clear any cached data in React Query
      // This is handled by the component that calls signOut
      
      return { error };
    } catch (err) {
      // Even if signOut fails, clear local state
      setUser(null);
      setSession(null);
      return { error: err as Error };
    }
  };

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };
};