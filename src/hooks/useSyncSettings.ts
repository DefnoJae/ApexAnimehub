import { useState, useEffect, useCallback } from 'react';
import type { SyncSettings, SyncProvider } from '@/types/sync';

const DEFAULT_SETTINGS: SyncSettings = {
  providers: {},
  autoSync: true,
  syncOnPlay: false,
  syncOnPause: true,
  notifyOnSync: true,
};

export function useSyncSettings() {
  const [settings, setSettings] = useState<SyncSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('sync_settings');
    if (saved) {
      try {
        setSettings(JSON.parse(saved));
      } catch (error) {
        console.error('Failed to load sync settings:', error);
      }
    }
    setLoading(false);
  }, []);

  const saveSettings = useCallback((newSettings: SyncSettings) => {
    setSettings(newSettings);
    localStorage.setItem('sync_settings', JSON.stringify(newSettings));
  }, []);

  const addProvider = useCallback(
    (provider: SyncProvider) => {
      const updated = {
        ...settings,
        providers: { ...settings.providers, [provider.id]: provider },
      };
      saveSettings(updated);
    },
    [settings, saveSettings]
  );

  const removeProvider = useCallback(
    (providerId: string) => {
      const updated = {
        ...settings,
        providers: Object.fromEntries(
          Object.entries(settings.providers).filter(([id]) => id !== providerId)
        ),
      };
      saveSettings(updated);
    },
    [settings, saveSettings]
  );

  const toggleAutoSync = useCallback(() => {
    const updated = { ...settings, autoSync: !settings.autoSync };
    saveSettings(updated);
  }, [settings, saveSettings]);

  const toggleSyncOnPlay = useCallback(() => {
    const updated = { ...settings, syncOnPlay: !settings.syncOnPlay };
    saveSettings(updated);
  }, [settings, saveSettings]);

  const toggleSyncOnPause = useCallback(() => {
    const updated = { ...settings, syncOnPause: !settings.syncOnPause };
    saveSettings(updated);
  }, [settings, saveSettings]);

  const toggleNotifications = useCallback(() => {
    const updated = { ...settings, notifyOnSync: !settings.notifyOnSync };
    saveSettings(updated);
  }, [settings, saveSettings]);

  return {
    settings,
    loading,
    saveSettings,
    addProvider,
    removeProvider,
    toggleAutoSync,
    toggleSyncOnPlay,
    toggleSyncOnPause,
    toggleNotifications,
  };
}
