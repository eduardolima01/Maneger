import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { searchRegistry } from '../services/searchRegistry';
import { recordAccess, recordQuery, getRecentEntries, getRecentQueries, getAccessFrequency } from '../services/recentSearchService';
import type { SearchResultItem, SearchCategory } from '../types/search.types';

const DEBOUNCE_MS = 120;

function applyRecencyBoost(items: SearchResultItem[]): SearchResultItem[] {
  return items
    .map((item) => {
      const freq = getAccessFrequency(item.id, item.category);
      // reduz o score (melhora o ranking) proporcionalmente ao uso — nunca inverte a ordem de um match muito melhor
      const boosted = Math.max(0, item.matchScore - Math.min(freq, 10) * 0.02);
      return { ...item, matchScore: boosted };
    })
    .sort((a, b) => a.matchScore - b.matchScore);
}

export function useGlobalSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = useCallback(async (q: string) => {
    setLoading(true);
    const providers = searchRegistry.list();
    const perProvider = await Promise.all(providers.map((p) => p.search(q)));
    const flat = perProvider.flat();
    setResults(applyRecencyBoost(flat));
    setSelectedIndex(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    debounceRef.current = setTimeout(() => runSearch(query), DEBOUNCE_MS);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  const groupedResults = useMemo(() => {
    const map = new Map<SearchCategory, SearchResultItem[]>();
    for (const item of results) {
      const list = map.get(item.category) ?? [];
      list.push(item);
      map.set(item.category, list);
    }
    return map;
  }, [results]);

  const flatOrderedResults = results; // já vem ordenado por matchScore

  const recentEntries = useMemo(() => getRecentEntries(), [query]); // recalcula toda vez que a busca reseta (query muda)
  const recentQueries = useMemo(() => getRecentQueries(), [query]);

  function selectResult(item: SearchResultItem) {
    recordAccess({ id: item.id, category: item.category, title: item.title, subtitle: item.subtitle, icon: item.icon });
    if (query.trim()) recordQuery(query.trim());
    item.onSelect();
  }

  function moveSelection(delta: number) {
    if (flatOrderedResults.length === 0) return;
    setSelectedIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return flatOrderedResults.length - 1;
      if (next >= flatOrderedResults.length) return 0;
      return next;
    });
  }

  function confirmSelection() {
    const item = flatOrderedResults[selectedIndex];
    if (item) selectResult(item);
  }

  function reset() {
    setQuery('');
    setResults([]);
    setSelectedIndex(0);
  }

  return {
    query, setQuery,
    results: flatOrderedResults, groupedResults, loading,
    selectedIndex, moveSelection, confirmSelection, selectResult,
    recentEntries, recentQueries,
    reset,
  };
}
