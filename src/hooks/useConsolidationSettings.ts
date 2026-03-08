import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface ConsolidationSettings {
  enabled: boolean;
  threshold: number;
}

export const useConsolidationSettings = () => {
  const { profile } = useAuth();
  const storageKey = profile?.id ? `consolidation_settings_${profile.id}` : null;

  const [enabled, setEnabled] = useState(false);
  const [threshold, setThreshold] = useState(10);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: ConsolidationSettings = JSON.parse(stored);
        setEnabled(parsed.enabled);
        setThreshold(parsed.threshold);
      }
    } catch {}
  }, [storageKey]);

  const save = (newEnabled: boolean, newThreshold: number) => {
    setEnabled(newEnabled);
    setThreshold(newThreshold);
    if (storageKey) {
      localStorage.setItem(storageKey, JSON.stringify({ enabled: newEnabled, threshold: newThreshold }));
    }
  };

  const setEnabledAndSave = (v: boolean) => save(v, threshold);
  const setThresholdAndSave = (v: number) => save(enabled, Math.max(1, v));

  return { enabled, threshold, setEnabled: setEnabledAndSave, setThreshold: setThresholdAndSave };
};
