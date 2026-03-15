import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Trash2, GripVertical, ChevronDown, FlaskConical } from 'lucide-react';
import { useOptionGroups } from '@/hooks/useOptionGroups';
import { useIngredients } from '@/hooks/useInventory';

interface OptionGroupsEditorProps {
  menuItemId: string;
}

const OptionGroupsEditor = ({ menuItemId }: OptionGroupsEditorProps) => {
  const {
    groups, loading,
    addGroup, updateGroup, removeGroup,
    addValue, updateValue, removeValue,
    addValueIngredient, removeValueIngredient,
  } = useOptionGroups(menuItemId);
  const { ingredients } = useIngredients();
  const [expandedIngredients, setExpandedIngredients] = useState<Record<string, boolean>>({});

  const handleAddGroup = async () => {
    await addGroup('', false, 'single');
  };

  const toggleIngredients = (valueId: string) => {
    setExpandedIngredients(prev => ({ ...prev, [valueId]: !prev[valueId] }));
  };

  if (loading) return <div className="text-sm text-muted-foreground py-2">Loading options...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">Option Groups</Label>
        <Button type="button" variant="outline" size="sm" onClick={handleAddGroup} className="gap-1">
          <Plus className="h-4 w-4" />
          Add Option Group
        </Button>
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center border border-dashed rounded-lg">
          No option groups. Click "Add Option Group" to add customization options.
        </p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.id} className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <GripVertical className="h-5 w-5 text-muted-foreground mt-1" />
                  <div className="flex-1 space-y-3">
                    <div className="flex gap-3">
                      <Input
                        placeholder="Group Name (e.g. Sweetness, Toppings)"
                        defaultValue={group.name}
                        onBlur={(e) => {
                          if (e.target.value !== group.name) {
                            updateGroup(group.id, { name: e.target.value });
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        type="button" variant="ghost" size="icon"
                        onClick={() => removeGroup(group.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-4 items-center">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={group.required}
                          onCheckedChange={(checked) => updateGroup(group.id, { required: checked })}
                        />
                        <Label className="text-sm">Required</Label>
                      </div>
                      <div className="flex items-center gap-3">
                        <Label className="text-sm text-muted-foreground">Selection:</Label>
                        <RadioGroup
                          value={group.selection_type}
                          onValueChange={(value) => updateGroup(group.id, { selection_type: value })}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="single" id={`single-${group.id}`} />
                            <Label htmlFor={`single-${group.id}`} className="text-sm font-normal">Single</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="multiple" id={`multiple-${group.id}`} />
                            <Label htmlFor={`multiple-${group.id}`} className="text-sm font-normal">Multiple</Label>
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

                  {group.values.map((val) => (
                    <div key={val.id} className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Label (e.g. Less, Normal, Extra)"
                          defaultValue={val.name}
                          onBlur={(e) => {
                            if (e.target.value !== val.name) {
                              updateValue(val.id, { name: e.target.value });
                            }
                          }}
                          className="flex-1"
                        />
                        <div className="flex items-center gap-1 w-28">
                          <span className="text-sm text-muted-foreground">$</span>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="0.00"
                            defaultValue={val.price_adjustment || ''}
                            onBlur={(e) => {
                              const p = parseFloat(e.target.value) || 0;
                              if (p !== val.price_adjustment) {
                                updateValue(val.id, { price_adjustment: p });
                              }
                            }}
                          />
                        </div>
                        <Button
                          type="button"
                          variant={val.is_default ? 'secondary' : 'ghost'}
                          size="sm"
                          onClick={() => updateValue(val.id, { is_default: !val.is_default })}
                          className="text-xs whitespace-nowrap"
                        >
                          {val.is_default ? 'Default ✓' : 'Set Default'}
                        </Button>
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => toggleIngredients(val.id)}
                          className="text-muted-foreground hover:text-foreground"
                          title="Ingredient impact"
                        >
                          <FlaskConical className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button" variant="ghost" size="icon"
                          onClick={() => removeValue(val.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={group.values.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Ingredient Impact Section */}
                      {expandedIngredients[val.id] && (
                        <div className="ml-4 p-3 bg-muted/50 rounded-lg space-y-2">
                          <Label className="text-xs text-muted-foreground">Ingredient Impact</Label>
                          <p className="text-[11px] text-muted-foreground">
                            These ingredients will be additionally deducted when this option is selected.
                          </p>

                          {val.ingredients && val.ingredients.length > 0 && (
                            <div className="space-y-1">
                              {val.ingredients.map(ing => (
                                <div key={ing.id} className="flex items-center gap-2 text-sm">
                                  <span className="flex-1">{ing.ingredient?.name || '—'}</span>
                                  <span className="text-muted-foreground">{ing.quantity} {ing.ingredient?.unit}</span>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeValueIngredient(ing.id)}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          )}

                          <IngredientAdder
                            ingredients={ingredients.filter(i =>
                              i.is_active && !val.ingredients?.some(vi => vi.ingredient_id === i.id)
                            )}
                            onAdd={(ingredientId, qty) => addValueIngredient(val.id, ingredientId, qty)}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  <Button
                    type="button" variant="ghost" size="sm"
                    onClick={() => addValue(group.id, '', 0, false)}
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

// Sub-component for adding ingredient to an option value
const IngredientAdder = ({
  ingredients,
  onAdd,
}: {
  ingredients: Array<{ id: string; name: string; unit: string }>;
  onAdd: (ingredientId: string, quantity: number) => void;
}) => {
  const [selectedId, setSelectedId] = useState('');
  const [qty, setQty] = useState('');

  const handleAdd = () => {
    if (!selectedId || !qty || parseFloat(qty) <= 0) return;
    onAdd(selectedId, parseFloat(qty));
    setSelectedId('');
    setQty('');
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Select ingredient" />
          </SelectTrigger>
          <SelectContent>
            {ingredients.map(i => (
              <SelectItem key={i.id} value={i.id}>{i.name} ({i.unit})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Input
        type="number" step="0.01" min="0" placeholder="Qty"
        value={qty} onChange={(e) => setQty(e.target.value)}
        className="w-20 h-8 text-xs"
      />
      <Button size="sm" variant="outline" onClick={handleAdd} className="h-8 text-xs">
        <Plus className="h-3 w-3" />
      </Button>
    </div>
  );
};

export default OptionGroupsEditor;
