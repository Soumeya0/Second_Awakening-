// Kept in its own module so hot-reloading player.jsx doesn't create a second context.
import { createContext } from 'react';

export const PlayerContext = createContext(null);
