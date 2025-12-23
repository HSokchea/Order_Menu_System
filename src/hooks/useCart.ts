import { useState, useEffect, useCallback } from 'react';

export interface SelectedOption {
  groupName: string;
  label: string;
  price: number;
}

export interface CartItem {
  id: string;
  cartItemId: string; // Unique ID for each cart entry (same item with different options = different entries)
  name: string;
  description?: string;
  price: number;
  price_usd?: number;
  price_khr?: number;
  is_available?: boolean;
  image_url?: string;
  quantity: number;
  selectedOptions?: SelectedOption[];
  optionsTotal?: number;
  hasValidationError?: boolean;
  validationReason?: string;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  is_available: boolean;
  category_id: string;
  image_url?: string;
}

// Generate unique cart item ID based on item and selected options
const generateCartItemId = (itemId: string, selectedOptions?: SelectedOption[]): string => {
  if (!selectedOptions || selectedOptions.length === 0) {
    return itemId;
  }
  const optionsKey = selectedOptions
    .map(o => `${o.groupName}:${o.label}`)
    .sort()
    .join('|');
  return `${itemId}_${btoa(optionsKey).slice(0, 12)}`;
};

export const useCart = (tableId?: string) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage on initialization
  useEffect(() => {
    if (!tableId) return;
    
    const savedCart = localStorage.getItem(`cart_${tableId}`);
    if (savedCart) {
      try {
        const parsedCart = JSON.parse(savedCart);
        setCart(parsedCart);
      } catch (error) {
        console.error('Error parsing saved cart:', error);
        localStorage.removeItem(`cart_${tableId}`);
      }
    }
    setIsLoaded(true);
  }, [tableId]);

  // Save cart to localStorage whenever it changes (but only after initial load)
  useEffect(() => {
    if (!tableId || !isLoaded) return;
    
    if (cart.length > 0) {
      localStorage.setItem(`cart_${tableId}`, JSON.stringify(cart));
    } else {
      localStorage.removeItem(`cart_${tableId}`);
    }
  }, [cart, tableId, isLoaded]);

  // Add item with options
  const addToCartWithOptions = useCallback((
    item: MenuItem,
    quantity: number,
    selectedOptions?: SelectedOption[]
  ) => {
    const cartItemId = generateCartItemId(item.id, selectedOptions);
    const optionsTotal = selectedOptions?.reduce((sum, opt) => sum + opt.price, 0) || 0;

    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.cartItemId === cartItemId);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.cartItemId === cartItemId
            ? { ...cartItem, quantity: cartItem.quantity + quantity }
            : cartItem
        );
      }
      return [...prev, {
        id: item.id,
        cartItemId,
        name: item.name,
        description: item.description,
        price: item.price_usd,
        price_usd: item.price_usd,
        is_available: item.is_available,
        image_url: item.image_url,
        quantity,
        selectedOptions,
        optionsTotal,
      }];
    });
  }, []);

  // Legacy: Add item without options (for quick add button)
  const addToCart = useCallback((item: MenuItem) => {
    addToCartWithOptions(item, 1, undefined);
  }, [addToCartWithOptions]);

  // Remove by cartItemId
  const removeFromCart = useCallback((cartItemId: string) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.cartItemId === cartItemId);
      if (existing && existing.quantity > 1) {
        return prev.map(cartItem =>
          cartItem.cartItemId === cartItemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
      return prev.filter(cartItem => cartItem.cartItemId !== cartItemId);
    });
  }, []);

  // Update quantity by cartItemId
  const updateCartItem = useCallback((cartItemId: string, quantity: number) => {
    if (quantity === 0) {
      setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
    } else {
      setCart(prev => prev.map(item =>
        item.cartItemId === cartItemId ? { ...item, quantity } : item
      ));
    }
  }, []);

  // Remove item entirely by cartItemId
  const removeCartItem = useCallback((cartItemId: string) => {
    setCart(prev => prev.filter(item => item.cartItemId !== cartItemId));
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    if (tableId) {
      localStorage.removeItem(`cart_${tableId}`);
    }
  }, [tableId]);

  // Get total including options prices
  const getTotalAmount = useCallback(() => {
    return cart.reduce((total, item) => {
      const basePrice = item.price_usd || item.price || 0;
      const optionsPrice = item.optionsTotal || 0;
      return total + ((basePrice + optionsPrice) * item.quantity);
    }, 0);
  }, [cart]);

  const getTotalItems = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  // Get count of a specific menu item (across all option variations)
  const getItemCount = useCallback((itemId: string) => {
    return cart
      .filter(cartItem => cartItem.id === itemId)
      .reduce((total, item) => total + item.quantity, 0);
  }, [cart]);

  const markItemsWithValidationErrors = useCallback((unavailableItems: Array<{id: string; name: string; reason: string}>) => {
    setCart(prev => prev.map(item => {
      const errorItem = unavailableItems.find(error => error.id === item.id);
      return errorItem ? {
        ...item,
        hasValidationError: true,
        validationReason: errorItem.reason
      } : item;
    }));
  }, []);

  const clearValidationErrors = useCallback(() => {
    setCart(prev => prev.map(item => ({
      ...item,
      hasValidationError: false,
      validationReason: undefined
    })));
  }, []);

  const removeUnavailableItems = useCallback((unavailableItemIds: string[]) => {
    setCart(prev => prev.filter(item => !unavailableItemIds.includes(item.id)));
  }, []);

  return {
    cart,
    isLoaded,
    addToCart,
    addToCartWithOptions,
    removeFromCart,
    updateCartItem,
    removeCartItem,
    clearCart,
    getTotalAmount,
    getTotalItems,
    getItemCount,
    markItemsWithValidationErrors,
    clearValidationErrors,
    removeUnavailableItems,
  };
};
