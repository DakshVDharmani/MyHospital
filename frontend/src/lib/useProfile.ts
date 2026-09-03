import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

export interface Profile {
  id: string | null;
  name: string;
  email: string;
  role: 'doctor' | 'patient' | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  /** National mobile number (no country code); +91 is assumed when texting. */
  phone: string | null;
  loading: boolean;
}

export interface ProfileState extends Profile {
  /** Persists a geocoded address to the user's row and reflects it locally. */
  saveAddress: (address: string, latitude: number, longitude: number) => Promise<void>;
  /** Persists the patient's mobile number (digits only, or '' to clear). */
  savePhone: (phone: string) => Promise<void>;
}

const FALLBACK: Profile = {
  id: null,
  name: '',
  email: '',
  role: null,
  address: null,
  latitude: null,
  longitude: null,
  phone: null,
  loading: true,
};

/** Loads the signed-in user's profile from the `users` table (falling back to
 * auth metadata, then a generic placeholder), so dashboard pages show the
 * real logged-in person rather than static copy. */
export function useProfile(): ProfileState {
  const [profile, setProfile] = useState<Profile>(FALLBACK);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user) {
        if (!cancelled) setProfile({ ...FALLBACK, name: 'there', loading: false });
        return;
      }

      const meta = user.user_metadata as { name?: string; role?: 'doctor' | 'patient' } | undefined;

      const { data: row } = await supabase
        .from('users')
        .select('name, email, role, address, latitude, longitude, phone')
        .eq('id', user.id)
        .single();
      if (cancelled) return;

      setProfile({
        id: user.id,
        name: row?.name || meta?.name || user.email || 'there',
        email: row?.email || user.email || '',
        role: (row?.role as Profile['role']) || meta?.role || null,
        address: row?.address ?? null,
        latitude: row?.latitude ?? null,
        longitude: row?.longitude ?? null,
        phone: row?.phone ?? null,
        loading: false,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const saveAddress = useCallback(
    async (address: string, latitude: number, longitude: number) => {
      if (!profile.id) throw new Error('Not signed in.');
      const { error } = await supabase.from('users').update({ address, latitude, longitude }).eq('id', profile.id);
      if (error) throw error;
      setProfile((p) => ({ ...p, address, latitude, longitude }));
    },
    [profile.id]
  );

  const savePhone = useCallback(
    async (phone: string) => {
      if (!profile.id) throw new Error('Not signed in.');
      const digits = phone.replace(/\D+/g, '');
      const next = digits ? digits : null;
      const { error } = await supabase.from('users').update({ phone: next }).eq('id', profile.id);
      if (error) throw error;
      setProfile((p) => ({ ...p, phone: next }));
    },
    [profile.id]
  );

  return { ...profile, saveAddress, savePhone };
}
