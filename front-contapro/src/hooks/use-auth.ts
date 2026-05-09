import { useState, useEffect } from 'react';
import { apiJson } from '@/lib/api';

export function useAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const checkAuth = async () => {
      try {
        const { ok, data } = await apiJson('/api/auth/me');
        if (!cancelled) {
          setIsAuthenticated(ok);
          setUser(data || null);
        }
      } catch (err) {
        if (!cancelled) {
          setIsAuthenticated(false);
          setUser(null);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    
    checkAuth();
    return () => { cancelled = true; };
  }, []);

  return { isAuthenticated, user, isLoading };
}
