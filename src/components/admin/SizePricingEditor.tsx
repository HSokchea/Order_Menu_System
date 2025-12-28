import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';

export interface SizeOption {
  label: string;
  price: number;
  default?: boolean;
}

interface SizePricingEditorProps {
  sizes: SizeOption[] | null;
  onChange: (sizes: SizeOption[] | null) => void;
}

const SizePricingEditor = ({ sizes, onChange }: SizePricingEditorProps) => {
  const sizeList = sizes || [];

  const addSize = () => {
    const newSize: SizeOption = {
      label: '',
      price: 0,
      default: sizeList.length === 0, // First size is default
    };
    onChange([...sizeList, newSize]);
  };

  const updateSize = (index: number, updates: Partial<SizeOption>) => {
    const newSizes = [...sizeList];
    newSizes[index] = { ...newSizes[index], ...updates };
    onChange(newSizes);
  };

  const removeSize = (index: number) => {
    const newSizes = sizeList.filter((_, i) => i !== index);
    // If we removed the default, set first remaining as default
    if (newSizes.length > 0 && !newSizes.some(s => s.default)) {
      newSizes[0].default = true;
    }
    onChange(newSizes.length > 0 ? newSizes : null);
  };

  const setDefaultSize = (index: number) => {
    const newSizes = sizeList.map((size, i) => ({
      ...size,
      default: i === index,
    }));
    onChange(newSizes);
  };

  // Find current default index for RadioGroup
  const defaultIndex = sizeList.findIndex(s => s.default);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Size Options</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addSize}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Size
        </Button>
      </div>

      {sizeList.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No sizes configured. Add at least one size with its price.
        </p>
      ) : (
        <Card className="border-border/50">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-[1fr_100px_80px_40px] gap-2 text-xs text-muted-foreground font-medium">
              <span>Size Label</span>
              <span>Price (USD)</span>
              <span>Default</span>
              <span></span>
            </div>
            
            <RadioGroup 
              value={defaultIndex.toString()} 
              onValueChange={(val) => setDefaultSize(parseInt(val))}
            >
              {sizeList.map((size, index) => (
                <div key={index} className="grid grid-cols-[1fr_100px_80px_40px] gap-2 items-center">
                  <Input
                    placeholder="e.g. Small, Medium, Large"
                    value={size.label}
                    onChange={(e) => updateSize(index, { label: e.target.value })}
                  />
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-muted-foreground">$</span>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={size.price || ''}
                      onChange={(e) =>
                        updateSize(index, { price: Math.max(0, parseFloat(e.target.value) || 0) })
                      }
                    />
                  </div>
                  <div className="flex justify-center">
                    <RadioGroupItem value={index.toString()} id={`default-${index}`} />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeSize(index)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    disabled={sizeList.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </RadioGroup>
            
            <p className="text-xs text-muted-foreground mt-2">
              The default size will be auto-selected when customers view this item.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SizePricingEditor;
