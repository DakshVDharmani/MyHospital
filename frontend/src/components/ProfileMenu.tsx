import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useProfile } from '../lib/useProfile';
import { geocodeAddress, searchAddresses, type GeocodeResult } from '../lib/geocode';
import { displayDoctorName, firstNameOf } from '../lib/formatName';
import { LocationMap } from './LocationMap';

const SUGGEST_DEBOUNCE_MS = 350;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileMenu() {
  const profile = useProfile();
  const [open, setOpen] = useState(false);
  const [addressInput, setAddressInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'locating' | 'saved' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [suggestions, setSuggestions] = useState<GeocodeResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  // The exact suggestion the user clicked, if any — lets Save skip a second
  // geocode call when the address hasn't changed since picking it.
  const pickedRef = useRef<GeocodeResult | null>(null);

  useEffect(() => {
    setAddressInput(profile.address ?? '');
  }, [profile.address]);

  // Debounced address-suggestion lookup — cancels the previous in-flight
  // request on every keystroke so responses can't race and land out of order.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (addressInput.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      searchAddresses(addressInput, { signal: controller.signal })
        .then((results) => {
          setSuggestions(results);
          setShowSuggestions(true);
          setHighlightIndex(-1);
        })
        .catch((err) => {
          if ((err as { name?: string })?.name !== 'AbortError') setSuggestions([]);
        });
    }, SUGGEST_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [addressInput]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const displayName = profile.loading ? '…' : profile.role === 'doctor' ? displayDoctorName(profile.name) : profile.name;

  const handleSelectSuggestion = (result: GeocodeResult) => {
    pickedRef.current = result;
    setAddressInput(result.displayName);
    setSuggestions([]);
    setShowSuggestions(false);
    setHighlightIndex(-1);
  };

  const handleSaveAddress = async () => {
    if (!addressInput.trim()) return;
    setStatus('locating');
    setErrorMsg('');
    setShowSuggestions(false);
    try {
      // If the user picked a suggestion and hasn't edited the field since,
      // reuse its coordinates instead of geocoding the same text again.
      const picked = pickedRef.current;
      const result = picked && picked.displayName === addressInput ? picked : await geocodeAddress(addressInput);
      if (!result) {
        setStatus('error');
        setErrorMsg("Couldn't find that address — try adding city and country.");
        return;
      }
      await profile.saveAddress(result.displayName, result.latitude, result.longitude);
      setAddressInput(result.displayName);
      setStatus('saved');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong finding that address.');
    }
  };

  return (
    <div className="profile-menu" ref={wrapRef}>
      <style>{`
        .profile-menu { position: relative; }
        .profile-menu-trigger {
          display: flex; align-items: center; gap: 10px;
          padding: 4px 4px 4px 10px; border-radius: 12px; border: 1.5px solid transparent;
          background: transparent; cursor: pointer; font-family: inherit;
          transition: border-color 0.2s var(--ease, ease), background 0.2s var(--ease, ease);
        }
        .profile-menu-trigger:hover, .profile-menu-trigger.profile-menu-trigger-on {
          border-color: var(--line, #D6E8E3); background: var(--field-bg, #fff);
        }
        .profile-menu-name { font-size: 12.5px; font-weight: 700; color: var(--navy, #0B2B3C); line-height: 1.3; }
        .profile-menu-role { font-size: 10.5px; font-weight: 600; color: var(--ink-soft, #5C7680); }
        .profile-menu-avatar {
          width: 34px; height: 34px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--teal, #0E9C8F) 0%, var(--teal-deep, #0B7A70) 100%);
          color: #fff; font-weight: 800; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 4px 10px rgba(14, 156, 143, 0.3);
        }

        .profile-menu-panel {
          position: absolute; top: calc(100% + 12px); right: 0;
          width: 320px; max-width: calc(100vw - 32px);
          background: var(--card-bg, #fff);
          border: 1px solid var(--line, #D6E8E3);
          border-radius: 16px;
          box-shadow: 0 2px 6px rgba(11, 43, 60, 0.06), 0 22px 48px rgba(6, 34, 32, 0.16);
          z-index: 40;
          transform-origin: top right;
          animation: profile-menu-in 0.16s cubic-bezier(.22,.61,.36,1);
        }
        @keyframes profile-menu-in {
          from { opacity: 0; transform: translateY(-6px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .profile-menu-head {
          display: flex; align-items: center; gap: 12px;
          padding: 16px; border-bottom: 1px solid var(--line, #D6E8E3);
          background: linear-gradient(180deg, rgba(14,156,143,0.06), rgba(14,156,143,0));
          border-radius: 16px 16px 0 0;
        }
        .profile-menu-head-avatar {
          width: 44px; height: 44px; border-radius: 50%; flex-shrink: 0;
          background: linear-gradient(135deg, var(--teal, #0E9C8F) 0%, var(--teal-deep, #0B7A70) 100%);
          color: #fff; font-weight: 800; font-size: 15px;
          display: flex; align-items: center; justify-content: center;
        }
        .profile-menu-head-name { font-family: 'Fraunces', 'Manrope', serif; font-weight: 600; font-size: 15px; color: var(--navy, #0B2B3C); }
        .profile-menu-head-email { font-size: 11.5px; color: var(--ink-soft, #5C7680); font-weight: 600; margin-top: 1px; word-break: break-all; }
        .profile-menu-head-role {
          display: inline-flex; margin-top: 6px;
          font-size: 10px; font-weight: 800; letter-spacing: 0.3px; text-transform: uppercase;
          color: var(--teal-deep, #0B7A70); background: rgba(14,156,143,0.1);
          padding: 3px 8px; border-radius: 999px;
        }

        .profile-menu-body { padding: 14px 16px 16px; }
        .profile-menu-label {
          display: flex; align-items: center; gap: 6px;
          font-size: 11px; font-weight: 800; color: var(--navy-soft, #4C6B78);
          margin-bottom: 6px; letter-spacing: 0.15px;
        }
        .profile-menu-input-row { display: flex; gap: 6px; }
        .profile-menu-input-wrap { position: relative; flex: 1; min-width: 0; }
        .profile-menu-input {
          width: 100%;
          border: 1.5px solid var(--line, #D6E8E3); border-radius: 9px;
          padding: 8px 10px; font-size: 12.5px; font-weight: 600; color: var(--ink, #10262E);
          background: var(--field-bg, #fff); outline: none; font-family: 'Manrope', sans-serif;
          transition: border-color 0.2s ease;
        }
        .profile-menu-input:focus { border-color: var(--teal, #0E9C8F); }

        .profile-menu-suggestions {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          background: var(--card-bg, #fff);
          border: 1px solid var(--line, #D6E8E3); border-radius: 10px;
          box-shadow: 0 10px 26px rgba(6, 34, 32, 0.14);
          list-style: none; margin: 0; padding: 5px;
          max-height: 190px; overflow-y: auto;
          z-index: 5;
        }
        .profile-menu-suggestion {
          display: flex; align-items: flex-start; gap: 7px;
          padding: 7px 8px; border-radius: 7px; cursor: pointer;
          font-size: 11.5px; font-weight: 600; color: var(--ink, #10262E); line-height: 1.35;
        }
        .profile-menu-suggestion svg { flex-shrink: 0; margin-top: 2px; color: var(--teal-deep, #0B7A70); }
        .profile-menu-suggestion:hover, .profile-menu-suggestion-active { background: var(--field-bg, #F2F8F7); }
        .profile-menu-save {
          flex-shrink: 0; border: none; border-radius: 9px;
          background: linear-gradient(135deg, var(--teal, #0E9C8F) 0%, var(--teal-deep, #0B7A70) 100%);
          color: #fff; font-weight: 800; font-size: 12px; padding: 0 12px;
          display: flex; align-items: center; justify-content: center; cursor: pointer;
        }
        .profile-menu-save:disabled { opacity: 0.6; cursor: not-allowed; }
        .profile-menu-status { display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; margin-top: 8px; }
        .profile-menu-status-ok { color: #0ca30c; }
        .profile-menu-status-err { color: #d03b3b; }
        .profile-menu-map-wrap { margin-top: 12px; border-radius: 12px; overflow: hidden; border: 1px solid var(--line, #D6E8E3); }
        .profile-menu-spin { animation: profile-menu-spin 0.8s linear infinite; }
        @keyframes profile-menu-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>

      <button
        type="button"
        className={`profile-menu-trigger ${open ? 'profile-menu-trigger-on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Open profile menu"
      >
        <div>
          <div className="profile-menu-name">{displayName}</div>
          <div className="profile-menu-role">{profile.role === 'doctor' ? 'Doctor' : profile.role === 'patient' ? 'Patient' : ''}</div>
        </div>
        <div className="profile-menu-avatar">{initials(profile.loading ? '' : profile.name)}</div>
      </button>

      {open && (
        <div className="profile-menu-panel" role="menu">
          <div className="profile-menu-head">
            <div className="profile-menu-head-avatar">{initials(profile.loading ? '' : profile.name)}</div>
            <div style={{ minWidth: 0 }}>
              <div className="profile-menu-head-name">{profile.loading ? 'Loading…' : `Hi, ${profile.role === 'doctor' ? displayDoctorName(profile.name) : firstNameOf(profile.name) || profile.name}`}</div>
              <div className="profile-menu-head-email">{profile.email}</div>
              {profile.role && <span className="profile-menu-head-role">{profile.role}</span>}
            </div>
          </div>

          <div className="profile-menu-body">
            <div className="profile-menu-label"><MapPin size={12} /> Your address</div>
            <div className="profile-menu-input-row">
              <div className="profile-menu-input-wrap">
                <input
                  className="profile-menu-input"
                  placeholder="e.g. 221B Baker Street, London"
                  value={addressInput}
                  autoComplete="off"
                  role="combobox"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-autocomplete="list"
                  onChange={(e) => {
                    setAddressInput(e.target.value);
                    pickedRef.current = null;
                    if (status !== 'idle') setStatus('idle');
                  }}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                  }}
                  onBlur={() => setShowSuggestions(false)}
                  onKeyDown={(e) => {
                    if (showSuggestions && suggestions.length > 0) {
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightIndex((i) => Math.min(i + 1, suggestions.length - 1));
                        return;
                      }
                      if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightIndex((i) => Math.max(i - 1, 0));
                        return;
                      }
                      if (e.key === 'Escape') {
                        setShowSuggestions(false);
                        return;
                      }
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (highlightIndex >= 0) handleSelectSuggestion(suggestions[highlightIndex]);
                        else handleSaveAddress();
                        return;
                      }
                    } else if (e.key === 'Enter') {
                      handleSaveAddress();
                    }
                  }}
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className="profile-menu-suggestions" role="listbox">
                    {suggestions.map((s, i) => (
                      <li
                        key={s.displayName}
                        role="option"
                        aria-selected={highlightIndex === i}
                        className={`profile-menu-suggestion ${highlightIndex === i ? 'profile-menu-suggestion-active' : ''}`}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleSelectSuggestion(s);
                        }}
                        onMouseEnter={() => setHighlightIndex(i)}
                      >
                        <MapPin size={12} />
                        <span>{s.displayName}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button className="profile-menu-save" onClick={handleSaveAddress} disabled={status === 'locating'}>
                {status === 'locating' ? <Loader2 size={14} className="profile-menu-spin" /> : 'Save'}
              </button>
            </div>

            {status === 'saved' && (
              <div className="profile-menu-status profile-menu-status-ok"><CheckCircle2 size={13} /> Location saved.</div>
            )}
            {status === 'error' && (
              <div className="profile-menu-status profile-menu-status-err"><AlertCircle size={13} /> {errorMsg}</div>
            )}

            {profile.latitude != null && profile.longitude != null && (
              <div className="profile-menu-map-wrap">
                <LocationMap latitude={profile.latitude} longitude={profile.longitude} label={profile.address ?? undefined} />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
