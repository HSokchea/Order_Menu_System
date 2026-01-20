import { useEffect, useCallback } from "react";

/**
 * Hook to guard against navigation when there are unsaved changes.
 * Shows a browser confirmation dialog when user tries to leave the page.
 */
export function useUnsavedChangesGuard(hasUnsavedChanges: boolean) {
  const handleBeforeUnload = useCallback(
    (event: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        event.preventDefault();
        // Modern browsers require returnValue to be set
        event.returnValue = "";
        return "";
      }
    },
    [hasUnsavedChanges]
  );

  useEffect(() => {
    if (hasUnsavedChanges) {
      window.addEventListener("beforeunload", handleBeforeUnload);
      return () => {
        window.removeEventListener("beforeunload", handleBeforeUnload);
      };
    }
  }, [hasUnsavedChanges, handleBeforeUnload]);
}
