import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/** Retorna verdadeiro enquanto a rota está sendo trocada (micro loading). */
export function useRouteTransition(): boolean {
  const location = useLocation();
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 150);
    return () => clearTimeout(t);
  }, [location.pathname]);

  return transitioning;
}

/** Simula um pequeno loading para operações financeiras (UX). */
export function useFakeLoading(ms = 700): [boolean, () => void, () => void] {
  void ms;
  const [loading, setLoading] = useState(false);
  return [loading, () => setLoading(true), () => setLoading(false)];
}

export function useDelayedFlag(ms: number): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return ready;
}
