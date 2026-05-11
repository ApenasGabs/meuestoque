import { useEffect } from "react";
import { useAppMode } from "./useAppMode";

/**
 * Hook that synchronizes the document.title with the current app mode.
 * Returns the appTitle so the caller doesn't need to subscribe to useAppMode again.
 */
export const useAppTitleSync = (): { appTitle: string } => {
  const { appTitle } = useAppMode();

  useEffect(() => {
    // Always keep document.title updated
    document.title = appTitle;
  }, [appTitle]);

  return { appTitle };
};
