import { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface Profile {
  name: string;
  email: string;
  role: 'doctor' | 'patient' | null;
  loading: boolean;
}

const FALLBACK: Profile = { name: '', email: '', role: null, loading: true };

/** Loads the signed-in user's profile from the `users` table (falling back to
 * auth metadata, then a generic placeholder), so dashboard pages show the
 * real logged-in person rather than static copy. */
export function useProfile(): Profile {
  const [profile, setProfile] = useState<Profile>(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (!cancelled) setProfile({ name: 'there', email: '', role: null, loading: false });
        return;
      }

      const meta = user.user_metadata as { name?: string; role?: 'doctor' | 'patient' } | undefined;

      const { data: row } = await supabase.from('users').select('name, email, role').eq('id', user.id).single();
      if (cancelled) return;

      setProfile({
        name: row?.name || meta?.name || user.email || 'there',
        email: row?.email || user.email || '',
        role: (row?.role as Profile['role']) || meta?.role || null,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return profile;
}
