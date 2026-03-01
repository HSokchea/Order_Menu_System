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
      <AlertDialogContent className="rounded-xl border-border/50 shadow-xl backdrop-blur-sm bg-background/95 max-w-sm pb-[env(safe-area-inset-bottom)]">
        <AlertDialogHeader className="text-left">
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
              className="flex-1 m-0 border-border hover:bg-muted"
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
                "bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
