import { useState, useEffect, useCallback } from 'react';

interface CartItem {
  id: string;
  name: string;
  description?: string;
  price: number;
  price_usd?: number;
  price_khr?: number;
  is_available?: boolean;
  image_url?: string;
  quantity: number;
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

  const addToCart = useCallback((item: MenuItem) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === item.id);
      if (existing) {
        return prev.map(cartItem =>
          cartItem.id === item.id
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { 
        ...item, 
        price: item.price_usd,
        quantity: 1 
      }];
    });
  }, []);

  const removeFromCart = useCallback((itemId: string) => {
    setCart(prev => {
      const existing = prev.find(cartItem => cartItem.id === itemId);
      if (existing && existing.quantity > 1) {
        return prev.map(cartItem =>
          cartItem.id === itemId
            ? { ...cartItem, quantity: cartItem.quantity - 1 }
            : cartItem
        );
      }
      return prev.filter(cartItem => cartItem.id !== itemId);
    });
  }, []);

  const updateCartItem = useCallback((itemId: string, quantity: number) => {
    if (quantity === 0) {
      setCart(prev => prev.filter(item => item.id !== itemId));
    } else {
      setCart(prev => prev.map(item =>
        item.id === itemId ? { ...item, quantity } : item
      ));
    }
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    if (tableId) {
      localStorage.removeItem(`cart_${tableId}`);
    }
  }, [tableId]);

  const getTotalAmount = useCallback(() => {
    return cart.reduce((total, item) => total + ((item.price_usd || item.price || 0) * item.quantity), 0);
  }, [cart]);

  const getTotalItems = useCallback(() => {
    return cart.reduce((total, item) => total + item.quantity, 0);
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
    removeFromCart,
    updateCartItem,
    clearCart,
    getTotalAmount,
    getTotalItems,
    markItemsWithValidationErrors,
    clearValidationErrors,
    removeUnavailableItems,
  };
};