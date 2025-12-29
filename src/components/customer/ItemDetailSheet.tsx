import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ImageIcon } from 'lucide-react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from '@/components/ui/drawer';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { SelectedOption } from '@/hooks/useCart';

export interface OptionValue {
  label: string;
  price: number;
  default?: boolean;
}

export interface OptionGroup {
  name: string;
  required: boolean;
  type: 'single' | 'multiple';
  values: OptionValue[];
}

export interface ItemOptions {
  options: OptionGroup[];
}

export interface SizeOption {
  label: string;
  price: number;
  default?: boolean;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  is_available: boolean;
  category_id: string;
  image_url?: string;
  options?: ItemOptions | null;
  size_enabled?: boolean;
  sizes?: SizeOption[] | null;
}

interface ItemDetailSheetProps {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: MenuItem, quantity: number, selectedOptions?: SelectedOption[]) => void;
}

const ItemDetailSheet = ({ item, open, onOpenChange, onAddToCart }: ItemDetailSheetProps) => {
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string | string[]>>({});
  const [selectedSizeIndex, setSelectedSizeIndex] = useState<number>(0);

  const options = item?.options?.options || [];
  const sizes = item?.sizes || [];
  const sizeEnabled = item?.size_enabled || false;

  // Initialize selections with defaults when item changes
  useEffect(() => {
    if (!item || !open) return;

    const initialSelections: Record<string, string | string[]> = {};
    options.forEach(group => {
      if (group.type === 'single') {
        // Find default or first option for required groups
        const defaultValue = group.values.find(v => v.default)?.label || 
          (group.required ? group.values[0]?.label : '');
        if (defaultValue) {
          initialSelections[group.name] = defaultValue;
        }
      } else {
        // Multiple selection - get all defaults
        const defaults = group.values.filter(v => v.default).map(v => v.label);
        initialSelections[group.name] = defaults;
      }
    });

    setSelections(initialSelections);
    setQuantity(1);

    // Auto-select default size for size-enabled items
    if (sizeEnabled && sizes.length > 0) {
      const defaultIndex = sizes.findIndex(s => s.default);
      setSelectedSizeIndex(defaultIndex >= 0 ? defaultIndex : 0);
    }
  }, [item?.id, open]);

  // Calculate options total (can be negative for discounts)
  const optionsTotal = useMemo(() => {
    let total = 0;
    options.forEach(group => {
      const selected = selections[group.name];
      if (group.type === 'single' && typeof selected === 'string') {
        const value = group.values.find(v => v.label === selected);
        if (value) total += value.price;
      } else if (group.type === 'multiple' && Array.isArray(selected)) {
        selected.forEach(label => {
          const value = group.values.find(v => v.label === label);
          if (value) total += value.price;
        });
      }
    });
    return total;
  }, [options, selections]);

  // Get base price (from size or item.price_usd)
  const basePrice = useMemo(() => {
    if (!item) return 0;
    if (sizeEnabled && sizes.length > 0) {
      return sizes[selectedSizeIndex]?.price || 0;
    }
    return item.price_usd;
  }, [item, sizeEnabled, sizes, selectedSizeIndex]);

  // Calculate final unit price (base + options, must be >= 0)
  const finalUnitPrice = useMemo(() => {
    return Math.max(0, basePrice + optionsTotal);
  }, [basePrice, optionsTotal]);

  // Calculate total price (final unit price * quantity)
  const totalPrice = useMemo(() => {
    return finalUnitPrice * quantity;
  }, [finalUnitPrice, quantity]);

  // Check if all required groups are selected
  const isValid = useMemo(() => {
    return options.every(group => {
      if (!group.required) return true;
      const selected = selections[group.name];
      if (group.type === 'single') {
        return typeof selected === 'string' && selected.length > 0;
      }
      return Array.isArray(selected) && selected.length > 0;
    });
  }, [options, selections]);

  const handleSingleSelect = (groupName: string, value: string, required: boolean) => {
    setSelections(prev => {
      const current = prev[groupName];
      // Allow deselection if not required and clicking the same value
      if (!required && current === value) {
        return { ...prev, [groupName]: '' };
      }
      return { ...prev, [groupName]: value };
    });
  };

  const handleMultipleSelect = (groupName: string, value: string, checked: boolean) => {
    setSelections(prev => {
      const current = (prev[groupName] as string[]) || [];
      if (checked) {
        return { ...prev, [groupName]: [...current, value] };
      }
      return { ...prev, [groupName]: current.filter(v => v !== value) };
    });
  };

  const handleAddToCart = () => {
    if (!item) return;

    // Build selected options array (including size if size-enabled)
    const selectedOptions: SelectedOption[] = [];

    // Add size as a selected option if size-enabled
    if (sizeEnabled && sizes.length > 0) {
      const selectedSize = sizes[selectedSizeIndex];
      if (selectedSize) {
        selectedOptions.push({
          groupName: 'Size',
          label: selectedSize.label,
          price: selectedSize.price,
        });
      }
    }

    options.forEach(group => {
      const selected = selections[group.name];
      if (group.type === 'single' && typeof selected === 'string' && selected) {
        const value = group.values.find(v => v.label === selected);
        if (value) {
          selectedOptions.push({
            groupName: group.name,
            label: value.label,
            price: value.price,
          });
        }
      } else if (group.type === 'multiple' && Array.isArray(selected)) {
        selected.forEach(label => {
          const value = group.values.find(v => v.label === label);
          if (value) {
            selectedOptions.push({
              groupName: group.name,
              label: value.label,
              price: value.price,
            });
          }
        });
      }
    });

    onAddToCart(item, quantity, selectedOptions.length > 0 ? selectedOptions : undefined);
    onOpenChange(false);
  };

  if (!item) return null;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[90vh]">
        <div className="overflow-y-auto max-h-[calc(90vh-140px)] mt-6">
          {/* Item Image */}
          {item.image_url ? (
            <div className="relative w-full aspect-video bg-muted">
              <img
                src={item.image_url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-full aspect-video bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center">
              <ImageIcon className="h-12 w-12 text-muted-foreground mb-2" />
            </div>
          )}

          <DrawerHeader className="text-left pb-2">
            <DrawerTitle className="text-xl">{item.name}</DrawerTitle>
            {item.description && (
              <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
            )}
            <p className="text-lg font-bold text-primary mt-2">
              ${basePrice.toFixed(2)}
              {optionsTotal !== 0 && (
                <span className={`text-sm font-normal ml-2 ${optionsTotal > 0 ? 'text-muted-foreground' : 'text-green-600'}`}>
                  {optionsTotal > 0 ? '+' : ''}{optionsTotal.toFixed(2)} options
                </span>
              )}
            </p>
          </DrawerHeader>

          {/* Size Selection (for size-enabled items) */}
          {sizeEnabled && sizes.length > 0 && (
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center gap-2">
                <Label className="text-base font-semibold">Size</Label>
                <Badge variant="secondary" className="text-xs">Required</Badge>
              </div>
              <div className="space-y-2">
                {sizes.map((size, index) => {
                  const isSelected = selectedSizeIndex === index;
                  return (
                    <div
                      key={index}
                      className={`flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'border-primary ring-1 ring-primary' : ''}`}
                      onClick={() => setSelectedSizeIndex(index)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-muted-foreground/50'}`}>
                          {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <span className="font-normal">{size.label}</span>
                      </div>
                      <span className="text-sm font-medium">${size.price.toFixed(2)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Option Groups */}
          {options.length > 0 && (
            <div className="px-4 pb-4 space-y-6">
              {options.map((group, groupIndex) => (
                <div key={groupIndex} className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Label className="text-base font-semibold">{group.name}</Label>
                    {group.required && (
                      <Badge variant="secondary" className="text-xs">Required</Badge>
                    )}
                    {group.type === 'multiple' && (
                      <Badge variant="outline" className="text-xs">Select multiple</Badge>
                    )}
                  </div>

                  {group.type === 'single' ? (
                    <div className="space-y-2">
                      {group.values.map((option, optionIndex) => {
                        const isSelected = selections[group.name] === option.label;
                        return (
                          <div
                            key={optionIndex}
                            className={`flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'border-primary ring-1 ring-primary' : ''}`}
                            onClick={() => handleSingleSelect(group.name, option.label, group.required)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary' : 'border-muted-foreground/50'}`}>
                                {isSelected && <div className="h-2 w-2 rounded-full bg-primary" />}
                              </div>
                              <span className="font-normal">{option.label}</span>
                            </div>
                            {option.price !== 0 && (
                              <span className={`text-sm ${option.price > 0 ? 'text-muted-foreground' : 'text-green-600'}`}>
                                {option.price > 0 ? '+' : ''}{option.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {group.values.map((option, optionIndex) => {
                        const isChecked = ((selections[group.name] as string[]) || []).includes(option.label);
                        return (
                          <div
                            key={optionIndex}
                            className="flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                id={`${group.name}-${optionIndex}`}
                                checked={isChecked}
                                onCheckedChange={(checked) =>
                                  handleMultipleSelect(group.name, option.label, !!checked)
                                }
                              />
                              <Label
                                htmlFor={`${group.name}-${optionIndex}`}
                                className="cursor-pointer font-normal"
                              >
                                {option.label}
                              </Label>
                            </div>
                            {option.price !== 0 && (
                              <span className={`text-sm ${option.price > 0 ? 'text-muted-foreground' : 'text-green-600'}`}>
                                {option.price > 0 ? '+' : ''}{option.price.toFixed(2)}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <DrawerFooter className="border-t bg-background">
          {/* Quantity Selector */}
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">Quantity</span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
                className="h-10 w-10 rounded-full"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="text-lg font-semibold min-w-[2rem] text-center">
                {quantity}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity(quantity + 1)}
                className="h-10 w-10 rounded-full"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Add to Cart Button */}
          <Button
            className="w-full h-12 text-base"
            onClick={handleAddToCart}
            disabled={!isValid}
          >
            <ShoppingCart className="h-5 w-5 mr-2" />
            Add to Cart – ${totalPrice.toFixed(2)}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
};

export default ItemDetailSheet;
