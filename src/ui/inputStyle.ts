import { Platform, type TextStyle } from 'react-native';

/** Drops the browser's rectangular focus outline so the field chrome can draw its own ring. */
export const noBrowserOutline: TextStyle = Platform.OS === 'web' ? { outlineWidth: 0 } : {};
