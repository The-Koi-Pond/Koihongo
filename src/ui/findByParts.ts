import { createContext } from "react";

/**
 * Opens the Dictionary's "Find by parts" with these components (their glyph
 * keys) already picked. Set by App everywhere except lessons and reviews, where
 * leaving would end the session; item pages only show the links when it's set.
 */
export const FindByPartsContext = createContext<((parts: string[]) => void) | undefined>(undefined);
