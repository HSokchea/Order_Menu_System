import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { startOfDay, endOfDay, subDays } from 'date-fns';
import type { InventoryTransaction } from './useInventory';

export type DatePreset = 'today' | 'last7days' | 'last30days' | 'custom';
export type DirectionFilter = 'all' | 'in' | 'out';

export interface HistoryFilters {
  datePreset: DatePreset;
  customFrom?: Date;
  customTo?: Date;
  ingredientId: string;
  direction: DirectionFilter;
  type: string;
  search: string;
  page: number;
}

const PAGE_SIZE = 50;

function getDateRange(filters: HistoryFilters): { from: Date; to: Date } {
  const now = new Date();
  switch (filters.datePreset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'last7days':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'last30days':
      return { from: startOfDay(subDays(now, 29)), to: endOfDay(now) };
    case 'custom':
      return {
        from: filters.customFrom ? startOfDay(filters.customFrom) : startOfDay(now),
        to: filters.customTo ? endOfDay(filters.customTo) : endOfDay(now),
      };
  }
}

export const useInventoryHistory = (restaurantId: string) => {
  const [transactions, setTransactions] = useState<InventoryTransaction[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<HistoryFilters>({
    datePreset: 'today',
    ingredientId: 'all',
    direction: 'all',
    type: 'all',
    search: '',
    page: 0,
  });

  const fetchTransactions = useCallback(async () => {
    if (!restaurantId) return;
    setRefreshing(true);

    const { from, to } = getDateRange(filters);

    let query = supabase
      .from('inventory_transactions')
      .select('*, ingredient:ingredients(name, unit)', { count: 'exact' })
      .eq('restaurant_id', restaurantId)
      .gte('created_at', from.toISOString())
      .lte('created_at', to.toISOString())
      .order('created_at', { ascending: false });

    if (filters.ingredientId !== 'all') {
      query = query.eq('ingredient_id', filters.ingredientId);
    }
    if (filters.type !== 'all') {
      query = query.eq('type', filters.type);
    }
    if (filters.direction === 'in') {
      query = query.gt('quantity', 0);
    } else if (filters.direction === 'out') {
      query = query.lt('quantity', 0);
    }

    query = query.range(filters.page * PAGE_SIZE, (filters.page + 1) * PAGE_SIZE - 1);

    const { data, error, count } = await query;

    if (!error && data) {
      setTransactions(data.map((t: any) => ({
        ...t,
        ingredient: Array.isArray(t.ingredient) ? t.ingredient[0] : t.ingredient,
      })));
      setTotalCount(count || 0);
    }
    setLoading(false);
  }, [restaurantId, filters]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  // Client-side search on already-fetched page
  const filtered = useMemo(() => {
    if (!filters.search.trim()) return transactions;
    const q = filters.search.toLowerCase();
    return transactions.filter(t =>
      t.ingredient?.name?.toLowerCase().includes(q) ||
      t.note?.toLowerCase().includes(q) ||
      t.reference_id?.toLowerCase().includes(q)
    );
  }, [transactions, filters.search]);

  // Summary from filtered results
  const summary = useMemo(() => {
    const totalIn = filtered.filter(t => t.quantity > 0).reduce((s, t) => s + t.quantity, 0);
    const totalOut = filtered.filter(t => t.quantity < 0).reduce((s, t) => s + t.quantity, 0);
    const waste = filtered.filter(t => t.type === 'waste').reduce((s, t) => s + t.quantity, 0);
    return { totalIn, totalOut, waste, netChange: totalIn + totalOut };
  }, [filtered]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const updateFilter = useCallback((patch: Partial<HistoryFilters>) => {
    setFilters(prev => ({ ...prev, page: 0, ...patch }));
  }, []);

  const setPage = useCallback((page: number) => {
    setFilters(prev => ({ ...prev, page }));
  }, []);

  return { transactions: filtered, loading, summary, filters, updateFilter, setPage, totalPages, totalCount, pageSize: PAGE_SIZE };
};
