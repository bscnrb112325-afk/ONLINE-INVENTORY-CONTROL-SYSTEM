import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../api';

interface SettingsData {
  companyName: string;
  logoUrl: string;
  currency: string;
  taxRate: string;
  theme: string;
  font: string;
}

interface SettingsContextType {
  settings: SettingsData | null;
  isLoading: boolean;
  refreshSettings: () => void;
}

const defaultSettings: SettingsData = {
  companyName: 'Online Inventory Control System',
  logoUrl: '',
  currency: 'KSh',
  taxRate: '0.00',
  theme: 'light',
  font: 'Inter'
};

const SettingsContext = createContext<SettingsContextType>({
  settings: defaultSettings,
  isLoading: true,
  refreshSettings: () => {}
});

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data: settingsData, isLoading, refetch } = useQuery({
    queryKey: ['globalSettings'],
    queryFn: async () => {
      const res = await api.get('/settings');
      return res.data;
    },
  });

  const settings = settingsData || defaultSettings;

  useEffect(() => {
    if (!isLoading && settings) {
      // Apply theme to HTML
      document.documentElement.setAttribute('data-theme', settings.theme);
      
      // Apply font to Body
      document.body.style.fontFamily = `"${settings.font}", sans-serif`;
    }
  }, [settings, isLoading]);

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center bg-base-200"><span className="loading loading-spinner loading-lg text-primary"></span></div>;
  }

  return (
    <SettingsContext.Provider value={{ settings, isLoading, refreshSettings: refetch }}>
      {children}
    </SettingsContext.Provider>
  );
};
