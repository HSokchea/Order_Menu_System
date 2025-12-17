import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, GripVertical } from 'lucide-react';

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

interface ItemOptionsEditorProps {
  value: ItemOptions | null;
  onChange: (value: ItemOptions | null) => void;
}

const ItemOptionsEditor = ({ value, onChange }: ItemOptionsEditorProps) => {
  const options = value?.options || [];

  const addOptionGroup = () => {
    const newGroup: OptionGroup = {
      name: '',
      required: false,
      type: 'single',
      values: [{ label: '', price: 0 }],
    };
    onChange({ options: [...options, newGroup] });
  };

  const updateOptionGroup = (index: number, updates: Partial<OptionGroup>) => {
    const newOptions = [...options];
    newOptions[index] = { ...newOptions[index], ...updates };
    onChange({ options: newOptions });
  };

  const removeOptionGroup = (index: number) => {
    const newOptions = options.filter((_, i) => i !== index);
    onChange(newOptions.length > 0 ? { options: newOptions } : null);
  };

  const addOptionValue = (groupIndex: number) => {
    const newOptions = [...options];
    newOptions[groupIndex].values.push({ label: '', price: 0 });
    onChange({ options: newOptions });
  };

  const updateOptionValue = (
    groupIndex: number,
    valueIndex: number,
    updates: Partial<OptionValue>
  ) => {
    const newOptions = [...options];
    newOptions[groupIndex].values[valueIndex] = {
      ...newOptions[groupIndex].values[valueIndex],
      ...updates,
    };
    onChange({ options: newOptions });
  };

  const removeOptionValue = (groupIndex: number, valueIndex: number) => {
    const newOptions = [...options];
    newOptions[groupIndex].values = newOptions[groupIndex].values.filter(
      (_, i) => i !== valueIndex
    );
    onChange({ options: newOptions });
  };

  const setDefaultValue = (groupIndex: number, valueIndex: number) => {
    const newOptions = [...options];
    // For single selection, only one default allowed
    if (newOptions[groupIndex].type === 'single') {
      newOptions[groupIndex].values = newOptions[groupIndex].values.map((v, i) => ({
        ...v,
        default: i === valueIndex ? !v.default : false,
      }));
    } else {
      // For multiple selection, toggle the default
      newOptions[groupIndex].values[valueIndex].default =
        !newOptions[groupIndex].values[valueIndex].default;
    }
    onChange({ options: newOptions });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Item Options</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addOptionGroup}
          className="gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Option Group
        </Button>
      </div>

      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No option groups. Click "Add Option Group" to add customization options like size, sweetness, or toppings.
        </p>
      ) : (
        <div className="space-y-4">
          {options.map((group, groupIndex) => (
            <Card key={groupIndex} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-1 cursor-grab" />
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Option Group Name (e.g. Size, Sweetness)"
                        value={group.name}
                        onChange={(e) =>
                          updateOptionGroup(groupIndex, { name: e.target.value })
                        }
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOptionGroup(groupIndex)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`required-${groupIndex}`}
                          checked={group.required}
                          onCheckedChange={(checked) =>
                            updateOptionGroup(groupIndex, { required: checked })
                          }
                        />
                        <Label htmlFor={`required-${groupIndex}`} className="text-sm">
                          Required
                        </Label>
                      </div>
                      
                      <div className="flex items-center gap-3">
                        <Label className="text-sm text-muted-foreground">Selection:</Label>
                        <RadioGroup
                          value={group.type}
                          onValueChange={(value: 'single' | 'multiple') =>
                            updateOptionGroup(groupIndex, { type: value })
                          }
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="single" id={`single-${groupIndex}`} />
                            <Label htmlFor={`single-${groupIndex}`} className="text-sm font-normal">
                              Single
                            </Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="multiple" id={`multiple-${groupIndex}`} />
                            <Label htmlFor={`multiple-${groupIndex}`} className="text-sm font-normal">
                              Multiple
                            </Label>
                          </div>
                        </RadioGroup>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0">
                <div className="space-y-2 pl-8">
                  <Label className="text-sm text-muted-foreground">Option Values</Label>
                  
                  {group.values.map((optionValue, valueIndex) => (
                    <div key={valueIndex} className="flex items-center gap-2">
                      <Input
                        placeholder="Label (e.g. Small, Medium)"
                        value={optionValue.label}
                        onChange={(e) =>
                          updateOptionValue(groupIndex, valueIndex, { label: e.target.value })
                        }
                        className="flex-1"
                      />
                      <div className="flex items-center gap-1 w-32">
                        <span className="text-sm text-muted-foreground">$</span>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={optionValue.price || ''}
                          onChange={(e) =>
                            updateOptionValue(groupIndex, valueIndex, {
                              price: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full"
                        />
                      </div>
                      <Button
                        type="button"
                        variant={optionValue.default ? 'secondary' : 'ghost'}
                        size="sm"
                        onClick={() => setDefaultValue(groupIndex, valueIndex)}
                        className="text-xs whitespace-nowrap"
                      >
                        {optionValue.default ? 'Default ✓' : 'Set Default'}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeOptionValue(groupIndex, valueIndex)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        disabled={group.values.length <= 1}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => addOptionValue(groupIndex)}
                    className="gap-1 text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3 w-3" />
                    Add Option Value
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ItemOptionsEditor;
