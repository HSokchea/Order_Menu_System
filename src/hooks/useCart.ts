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
  basePrice: number; // Base price of the item (Rule 1)
  price: number; // Legacy field for compatibility
  price_usd?: number;
  price_khr?: number;
  is_available?: boolean;
  image_url?: string;
  quantity: number;
  selectedOptions?: SelectedOption[];
  optionsTotal: number; // Sum of option price adjustments (can be negative)
  finalUnitPrice: number; // basePrice + optionsTotal, must be >= 0 (Rule 4)
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
  size_enabled?: boolean;
  sizes?: Array<{ label: string; price: number; default?: boolean }> | null;
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

  // Add item with options (Rule 4, 5, 6)
  const addToCartWithOptions = useCallback((
    item: MenuItem,
    quantity: number,
    selectedOptions?: SelectedOption[]
  ) => {
    const cartItemId = generateCartItemId(item.id, selectedOptions);
    
    // Determine base price: if size-enabled, base price comes from the Size option
    let basePrice = item.price_usd;
    let optionsTotal = 0;
    
    if (item.size_enabled && selectedOptions) {
      // For size-enabled items, the Size option's price IS the base price
      const sizeOption = selectedOptions.find(o => o.groupName === 'Size');
      if (sizeOption) {
        basePrice = sizeOption.price;
        // Options total is the sum of all NON-size options
        optionsTotal = selectedOptions
          .filter(o => o.groupName !== 'Size')
          .reduce((sum, opt) => sum + opt.price, 0);
      }
    } else {
      // Fixed price items: base price from item, options add/subtract
      optionsTotal = selectedOptions?.reduce((sum, opt) => sum + opt.price, 0) || 0;
    }
    
    const finalUnitPrice = Math.max(0, basePrice + optionsTotal); // Rule 4: must be >= 0

    // Rule 6: Validate before adding - quantity must be >= 1
    if (quantity < 1) return;

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
        basePrice, // Store base price (Rule 7)
        price: item.price_usd,
        price_usd: item.price_usd,
        is_available: item.is_available,
        image_url: item.image_url,
        quantity,
        selectedOptions,
        optionsTotal, // Store options total (Rule 7)
        finalUnitPrice, // Store final unit price (Rule 7)
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

  // Update quantity by cartItemId (Rule 5: quantity must be >= 1)
  const updateCartItem = useCallback((cartItemId: string, quantity: number) => {
    if (quantity < 1) {
      // Remove item if quantity is 0 or less
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

  // Get total including options prices (Rule 5: Total = finalUnitPrice * quantity)
  const getTotalAmount = useCallback(() => {
    return cart.reduce((total, item) => {
      // Use stored finalUnitPrice for accurate calculation
      return total + (item.finalUnitPrice * item.quantity);
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
