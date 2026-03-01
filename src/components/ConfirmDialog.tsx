import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode; // string -> React.ReactNode
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "destructive" | "default" | "success"; // add "success"
  onConfirm?: () => void; // make optional
  onCancel?: () => void;
  loading?: boolean;
  confirmDisabled?: boolean; // add missing props
  cancelDisabled?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
  confirmDisabled = false,
  cancelDisabled = false,
  loading = false,
}: ConfirmDialogProps) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const handleConfirm = () => {
    onConfirm?.();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-2xl shadow-xl backdrop-blur-sm bg-background/95 w-[calc(100%-2rem)] max-w-sm p-6 pb-safe">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-semibold text-foreground">
            {title}
          </AlertDialogTitle>
          {description && (
            <AlertDialogDescription className="text-sm text-muted-foreground">
              {description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>

        <div className="flex flex-row gap-2 mt-4">
          {cancelLabel && (
            <AlertDialogCancel
              onClick={handleCancel}
              disabled={cancelDisabled}
            >
              {cancelLabel}
            </AlertDialogCancel>
          )}
          {confirmLabel && (
            <AlertDialogAction
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className={cn(
                "flex-1",
                variant === "destructive" &&
                "bg-destructive text-destructive-foreground"
              )}
            >
              {confirmLabel}
            </AlertDialogAction>
          )}
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
