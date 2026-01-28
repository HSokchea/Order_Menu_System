import { useState, useEffect, useCallback } from 'react';

export interface LocalCartItem {
  id: string;
  menu_item_id: string;
  name: string;
  quantity: number;
  price_usd: number;
  options?: Array<{
    groupName: string;
    label: string;
    price: number;
  }>;
}

interface LocalCart {
  shopId: string;
  tableId: string | null;
  items: LocalCartItem[];
  notes: string;
}

const CART_STORAGE_KEY = 'local_cart';

/**
 * Hook to manage local cart state stored in localStorage.
 * This cart is ONLY for browsing/selection - NO backend calls.
 * Orders are created only when customer explicitly places the order.
 */
export const useLocalCart = (shopId?: string, tableId?: string | null) => {
  const [cart, setCart] = useState<LocalCart | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    if (!shopId) {
      setIsLoaded(true);
      return;
    }

    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed: LocalCart = JSON.parse(stored);
        // Only restore if same shop
        if (parsed.shopId === shopId) {
          // Update tableId if it changed (e.g., user scanned table QR after starting)
          setCart({
            ...parsed,
            tableId: tableId || parsed.tableId,
          });
        } else {
          // Different shop, start fresh
          setCart({
            shopId,
            tableId: tableId || null,
            items: [],
            notes: '',
          });
        }
      } else {
        // No stored cart, start fresh
        setCart({
          shopId,
          tableId: tableId || null,
          items: [],
          notes: '',
        });
      }
    } catch (err) {
      console.error('Error loading cart from localStorage:', err);
      setCart({
        shopId,
        tableId: tableId || null,
        items: [],
        notes: '',
      });
    }
    setIsLoaded(true);
  }, [shopId, tableId]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (cart && isLoaded) {
      try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
      } catch (err) {
        console.error('Error saving cart to localStorage:', err);
      }
    }
  }, [cart, isLoaded]);

  // Calculate total from items
  const calculateTotal = useCallback((items: LocalCartItem[]): number => {
    return items.reduce((sum, item) => {
      const optionsTotal = item.options?.reduce((optSum, opt) => optSum + opt.price, 0) || 0;
      return sum + (item.price_usd + optionsTotal) * item.quantity;
    }, 0);
  }, []);

  // Get total
  const total = cart ? calculateTotal(cart.items) : 0;

  // Add item to cart (LOCAL ONLY - no backend call)
  const addItem = useCallback((item: LocalCartItem) => {
    setCart(prev => {
      if (!prev) return prev;

      const existingItems = [...prev.items];
      const existingIndex = existingItems.findIndex(i => 
        i.menu_item_id === item.menu_item_id && 
        JSON.stringify(i.options) === JSON.stringify(item.options)
      );

      if (existingIndex >= 0) {
        existingItems[existingIndex].quantity += item.quantity;
      } else {
        existingItems.push({ ...item, id: `${item.menu_item_id}-${Date.now()}` });
      }

      return { ...prev, items: existingItems };
    });
  }, []);

  // Remove item from cart (LOCAL ONLY)
  const removeItem = useCallback((itemId: string) => {
    setCart(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.filter(i => i.id !== itemId),
      };
    });
  }, []);

  // Remove item by menu_item_id (for quick remove on menu page)
  const removeByMenuItemId = useCallback((menuItemId: string) => {
    setCart(prev => {
      if (!prev) return prev;
      // Find and remove first matching item
      const idx = prev.items.findIndex(i => i.menu_item_id === menuItemId);
      if (idx === -1) return prev;
      
      const newItems = [...prev.items];
      if (newItems[idx].quantity > 1) {
        newItems[idx] = { ...newItems[idx], quantity: newItems[idx].quantity - 1 };
      } else {
        newItems.splice(idx, 1);
      }
      return { ...prev, items: newItems };
    });
  }, []);

  // Update item quantity (LOCAL ONLY)
  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }

    setCart(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        items: prev.items.map(i => 
          i.id === itemId ? { ...i, quantity } : i
        ),
      };
    });
  }, [removeItem]);

  // Update notes (LOCAL ONLY)
  const updateNotes = useCallback((notes: string) => {
    setCart(prev => {
      if (!prev) return prev;
      return { ...prev, notes };
    });
  }, []);

  // Clear cart (LOCAL ONLY)
  const clearCart = useCallback(() => {
    setCart(prev => {
      if (!prev) return prev;
      return { ...prev, items: [], notes: '' };
    });
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  // Get item count for a specific menu item
  const getItemCount = useCallback((menuItemId: string): number => {
    if (!cart) return 0;
    return cart.items
      .filter(item => item.menu_item_id === menuItemId)
      .reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  // Get total items count
  const getTotalItems = useCallback((): number => {
    if (!cart) return 0;
    return cart.items.reduce((sum, item) => sum + item.quantity, 0);
  }, [cart]);

  return {
    cart,
    items: cart?.items || [],
    notes: cart?.notes || '',
    total,
    isLoaded,
    shopId: cart?.shopId || null,
    tableId: cart?.tableId || null,
    addItem,
    removeItem,
    removeByMenuItemId,
    updateItemQuantity,
    updateNotes,
    clearCart,
    getItemCount,
    getTotalItems,
  };
};
