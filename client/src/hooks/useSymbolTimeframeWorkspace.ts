import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useRoute } from "wouter";

import { baseAssetFromUsdt } from "@/lib/symbols";

interface Options {
  routePattern: string;
  buildPath: (symbol: string, timeframe: string) => string;
  defaultSymbol: string;
  defaultTimeframe: string;
  parseSymbol: (input?: string | null) => string;
  parseTimeframe: (input?: string | null) => string;
  querySymbolParam?: string;
  timeframeQueryParam?: string;
  deriveSearchInput?: (symbol: string) => string;
}

interface SymbolTimeframeWorkspace {
  selectedSymbol: string;
  selectedTimeframe: string;
  searchInput: string;
  setSearchInput: (value: string) => void;
  setSymbol: (value: string, options?: { keepSearchInput?: boolean }) => void;
  setTimeframe: (value: string) => void;
  applySearchSymbol: (input?: string) => string;
}

function getSearchParams(): URLSearchParams {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

export function useSymbolTimeframeWorkspace({
  routePattern,
  buildPath,
  defaultSymbol,
  defaultTimeframe,
  parseSymbol,
  parseTimeframe,
  querySymbolParam,
  timeframeQueryParam = "tf",
  deriveSearchInput,
}: Options): SymbolTimeframeWorkspace {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute(routePattern);

  const deriveInput = useCallback(
    (symbol: string) => {
      if (deriveSearchInput) return deriveSearchInput(symbol);
      return baseAssetFromUsdt(symbol) || symbol || "BTC";
    },
    [deriveSearchInput],
  );

  const resolveSymbol = useCallback(() => {
    const search = getSearchParams();
    const querySymbol = querySymbolParam ? search.get(querySymbolParam) : null;
    return parseSymbol(params?.symbol ?? querySymbol ?? defaultSymbol);
  }, [defaultSymbol, params?.symbol, parseSymbol, querySymbolParam]);

  const resolveTimeframe = useCallback(() => {
    const search = getSearchParams();
    const queryTimeframe = search.get(timeframeQueryParam);
    return parseTimeframe(queryTimeframe ?? defaultTimeframe);
  }, [defaultTimeframe, parseTimeframe, timeframeQueryParam]);

  const [selectedSymbol, setSelectedSymbolState] = useState(resolveSymbol);
  const [selectedTimeframe, setSelectedTimeframeState] = useState(resolveTimeframe);
  const [searchInput, setSearchInputState] = useState(() => deriveInput(resolveSymbol()));

  const symbolRef = useRef(selectedSymbol);
  const timeframeRef = useRef(selectedTimeframe);

  useEffect(() => {
    symbolRef.current = selectedSymbol;
  }, [selectedSymbol]);

  useEffect(() => {
    timeframeRef.current = selectedTimeframe;
  }, [selectedTimeframe]);

  useEffect(() => {
    if (!match) return;
    const nextSymbol = resolveSymbol();
    const nextTimeframe = resolveTimeframe();
    setSelectedSymbolState(nextSymbol);
    setSelectedTimeframeState(nextTimeframe);
    setSearchInputState(deriveInput(nextSymbol));
  }, [match, location, deriveInput, resolveSymbol, resolveTimeframe]);

  const updateLocation = useCallback(
    (symbol: string, timeframe: string) => {
      const target = buildPath(symbol, timeframe);
      if (target !== location) {
        setLocation(target);
      }
    },
    [buildPath, location, setLocation],
  );

  const setSymbol = useCallback(
    (value: string, options?: { keepSearchInput?: boolean }) => {
      const nextSymbol = parseSymbol(value);
      setSelectedSymbolState(nextSymbol);
      symbolRef.current = nextSymbol;
      if (!options?.keepSearchInput) {
        setSearchInputState(deriveInput(nextSymbol));
      }
      updateLocation(nextSymbol, timeframeRef.current);
      return nextSymbol;
    },
    [deriveInput, parseSymbol, updateLocation],
  );

  const setTimeframe = useCallback(
    (value: string) => {
      const nextTimeframe = parseTimeframe(value);
      setSelectedTimeframeState(nextTimeframe);
      timeframeRef.current = nextTimeframe;
      updateLocation(symbolRef.current, nextTimeframe);
      return nextTimeframe;
    },
    [parseTimeframe, updateLocation],
  );

  const applySearchSymbol = useCallback(
    (input?: string) => {
      const next = input ?? searchInput;
      const normalized = setSymbol(next);
      return normalized;
    },
    [searchInput, setSymbol],
  );

  const setSearchInput = useCallback((value: string) => {
    setSearchInputState(value);
  }, []);

  return useMemo(
    () => ({
      selectedSymbol,
      selectedTimeframe,
      searchInput,
      setSearchInput,
      setSymbol,
      setTimeframe,
      applySearchSymbol,
    }),
    [applySearchSymbol, searchInput, selectedSymbol, selectedTimeframe, setSearchInput, setSymbol, setTimeframe],
  );
}
