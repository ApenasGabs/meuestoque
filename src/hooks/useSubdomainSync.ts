import { useEffect } from "react";
import { useAppMode } from "./useAppMode";

/**
 * Hook that synchronizes the document.title with the current app mode.
 */
export const useSubdomainSync = (): void => {
  const { appTitle } = useAppMode();

  useEffect(() => {
    // Always keep document.title updated
    document.title = appTitle;
  }, [appTitle]);
};
