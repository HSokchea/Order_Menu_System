import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ImageIcon, Plus, Minus, ShoppingCart } from 'lucide-react';
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

export interface MenuItem {
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

interface ItemDetailContentProps {
  item: MenuItem;
  open: boolean;
  onAddToCart: (item: MenuItem, quantity: number, selectedOptions?: SelectedOption[]) => void;
  onClose: () => void;
  variant?: 'mobile' | 'desktop';
}

const ItemDetailContent = ({ item, open, onAddToCart, onClose, variant = 'mobile' }: ItemDetailContentProps) => {
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
        const defaultValue = group.values.find(v => v.default)?.label ||
          (group.required ? group.values[0]?.label : '');
        if (defaultValue) {
          initialSelections[group.name] = defaultValue;
        }
      } else {
        const defaults = group.values.filter(v => v.default).map(v => v.label);
        initialSelections[group.name] = defaults;
      }
    });

    setSelections(initialSelections);
    setQuantity(1);

    if (sizeEnabled && sizes.length > 0) {
      const defaultIndex = sizes.findIndex(s => s.default);
      setSelectedSizeIndex(defaultIndex >= 0 ? defaultIndex : 0);
    }
  }, [item?.id, open]);

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

  const basePrice = useMemo(() => {
    if (!item) return 0;
    if (sizeEnabled && sizes.length > 0) {
      return sizes[selectedSizeIndex]?.price || 0;
    }
    return item.price_usd;
  }, [item, sizeEnabled, sizes, selectedSizeIndex]);

  const finalUnitPrice = useMemo(() => {
    return Math.max(0, basePrice + optionsTotal);
  }, [basePrice, optionsTotal]);

  const totalPrice = useMemo(() => {
    return finalUnitPrice * quantity;
  }, [finalUnitPrice, quantity]);

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

    const selectedOptions: SelectedOption[] = [];

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
    onClose();
  };

  // Shared components
  const ImageSection = ({ className = '' }: { className?: string }) => (
    item.image_url ? (
      <div className={`relative bg-muted overflow-hidden ${className}`}>
        <img
          src={item.image_url}
          alt={item.name}
          className="w-full h-full object-cover"
        />
      </div>
    ) : (
      <div className={`bg-gradient-to-br from-muted to-muted/80 flex items-center justify-center ${className}`}>
        <ImageIcon className="h-12 w-12 text-muted-foreground" />
      </div>
    )
  );

  const PriceDisplay = () => (
    <p className="text-xl font-bold text-primary">
      ${basePrice.toFixed(2)}
      {optionsTotal !== 0 && (
        <span className={`text-sm font-normal ml-2 ${optionsTotal > 0 ? 'text-muted-foreground' : 'text-green-600'}`}>
          {optionsTotal > 0 ? '+' : ''}{optionsTotal.toFixed(2)} options
        </span>
      )}
    </p>
  );

  const SizeSelection = () => (
    sizeEnabled && sizes.length > 0 ? (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-semibold">Size</Label>
          <Badge variant="secondary" className="text-xs">Required</Badge>
        </div>
        <div className="space-y-2">
          {sizes.map((size, index) => {
            const isSelected = selectedSizeIndex === index;
            return (
              <div
                key={index}
                className={`flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-all cursor-pointer ${isSelected ? 'border-primary ring-1 ring-primary shadow-sm' : 'hover:border-muted-foreground/30'}`}
                onClick={() => setSelectedSizeIndex(index)}
              >
                <div className="flex items-center gap-3">
                  <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary' : 'border-muted-foreground/50'}`}>
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
    ) : null
  );

  const OptionGroups = () => (
    options.length > 0 ? (
      <div className="space-y-5">
        {options.map((group, groupIndex) => (
          <div key={groupIndex} className="space-y-3">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">{group.name}</Label>
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
                      className={`flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-all cursor-pointer ${isSelected ? 'border-primary ring-1 ring-primary shadow-sm' : 'hover:border-muted-foreground/30'}`}
                      onClick={() => handleSingleSelect(group.name, option.label, group.required)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-primary' : 'border-muted-foreground/50'}`}>
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
                      className={`flex items-center justify-between p-3 rounded-lg border bg-background hover:bg-muted/50 transition-all cursor-pointer ${isChecked ? 'border-primary ring-1 ring-primary shadow-sm' : 'hover:border-muted-foreground/30'}`}
                      onClick={() => handleMultipleSelect(group.name, option.label, !isChecked)}
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
    ) : null
  );

  const QuantitySelector = () => (
    <div className="flex items-center justify-between">
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
  );

  const AddToCartButton = () => (
    <Button
      className="w-full h-12 text-base font-semibold"
      onClick={handleAddToCart}
      disabled={!isValid}
    >
      <ShoppingCart className="h-5 w-5 mr-2" />
      Add to Cart – ${totalPrice.toFixed(2)}
    </Button>
  );

  // Mobile Layout (vertical stack)
  if (variant === 'mobile') {
    return (
      <div className="flex flex-col h-full">
        <div className="overflow-y-auto flex-1">
          <ImageSection className="w-full aspect-video" />

          <div className="p-4 pb-2 text-left">
            <div className="flex items-start justify-between">
              <h2 className="text-xl font-semibold leading-none tracking-tight">
                {item.name}
              </h2>

              <div className="ml-2">
                <PriceDisplay />
              </div>
            </div>

            {item.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {item.description}
              </p>
            )}
          </div>

          <div className="px-4 pb-4 space-y-4">
            <SizeSelection />
            <OptionGroups />
          </div>
        </div>

        <div className="border-t bg-background p-4 mt-auto space-y-4">
          <QuantitySelector />
          <AddToCartButton />
        </div>
      </div>
    );
  }

  // Desktop Layout (two columns: image left, details right)
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Left Column - Image */}
        <div className="w-3/6 shrink-0 bg-muted">
          <ImageSection className="w-full h-full min-h-[300px]" />
        </div>

        {/* Right Column - Details */}
        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 overflow-y-auto scrollbar-hide">
            <div className="p-6 space-y-5">
              {/* Name */}
              {item.name && (
                <p className="text-lg font-semibold text-muted-background leading-relaxed">{item.name}</p>
              )}

              {/* Description */}
              {item.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              )}

              {/* Price */}
              <PriceDisplay />

              {/* Size Selection */}
              <SizeSelection />

              {/* Option Groups */}
              <OptionGroups />
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t bg-background p-4 space-y-4 shrink-0">
            <QuantitySelector />
            <AddToCartButton />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItemDetailContent;
