import { useIsMobile } from '@/hooks/use-mobile';
import {
  Drawer,
  DrawerContent,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import ItemDetailContent, { MenuItem } from './ItemDetailContent';
import { SelectedOption } from '@/hooks/useCart';

// Re-export types for backward compatibility
export type { OptionValue, OptionGroup, ItemOptions, SizeOption, MenuItem } from './ItemDetailContent';

interface ItemDetailSheetProps {
  item: MenuItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddToCart: (item: MenuItem, quantity: number, selectedOptions?: SelectedOption[]) => void;
}

const ItemDetailSheet = ({ item, open, onOpenChange, onAddToCart }: ItemDetailSheetProps) => {
  const isMobile = useIsMobile();

  if (!item) return null;

  const handleClose = () => onOpenChange(false);

  // Mobile: Use Drawer (bottom sheet)
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <div className="mt-4 max-h-[calc(90vh-2rem)] overflow-hidden flex flex-col">
            <ItemDetailContent
              item={item}
              open={open}
              onAddToCart={onAddToCart}
              onClose={handleClose}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Tablet/Desktop: Use Dialog (modal)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-lg max-h-[85vh] p-0 overflow-hidden flex flex-col"
        hideCloseButton={false}
      >
        <ItemDetailContent
          item={item}
          open={open}
          onAddToCart={onAddToCart}
          onClose={handleClose}
        />
      </DialogContent>
    </Dialog>
  );
};

export default ItemDetailSheet;
