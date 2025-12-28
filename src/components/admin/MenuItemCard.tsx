import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, GripVertical, ImageIcon } from 'lucide-react';

interface SizeOption {
  label: string;
  price: number;
  default?: boolean;
}

interface Category {
  id: string;
  name: string;
  display_order: number;
}

interface MenuItem {
  id: string;
  name: string;
  description?: string;
  price_usd: number;
  category_id: string;
  is_available: boolean;
  image_url?: string;
  category?: Category;
  size_enabled?: boolean;
  sizes?: SizeOption[] | null;
}

// Get display price: for size-based items, use default size price
const getDisplayPrice = (item: MenuItem): number => {
  if (item.size_enabled && item.sizes && item.sizes.length > 0) {
    const defaultSize = item.sizes.find(s => s.default);
    return defaultSize ? defaultSize.price : item.sizes[0].price;
  }
  return item.price_usd;
};

interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  dragProps?: any;
}

const MenuItemCard = ({ item, onEdit, onDelete, dragProps }: MenuItemCardProps) => {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Drag Handle */}
          {dragProps && (
            <div {...dragProps.dragHandleProps} className="flex items-center">
              <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
            </div>
          )}
          
          {/* Image */}
          <div className="flex-shrink-0">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                className="w-20 h-20 object-cover rounded-lg border"
              />
            ) : (
              <div className="w-20 h-20 bg-muted/20 rounded-lg border flex items-center justify-center">
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{item.name}</h3>
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {item.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="font-bold text-primary text-lg">
                    ${getDisplayPrice(item).toFixed(2)}
                  </span>
                  {item.category && (
                    <Badge variant="secondary" className="text-xs">
                      {item.category.name}
                    </Badge>
                  )}
                  <Badge 
                    variant={item.is_available ? "default" : "secondary"}
                    className={item.is_available ? "bg-success" : ""}
                  >
                    {item.is_available ? 'Available' : 'Unavailable'}
                  </Badge>
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-1 ml-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onEdit(item)}
                  className="h-8 w-8 p-0"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDelete(item.id)}
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MenuItemCard;