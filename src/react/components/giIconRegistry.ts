import * as GiIcons from 'react-icons/gi';
import type { IconType } from 'react-icons';

export function resolveGiIcon(name: string): IconType | undefined {
  return (GiIcons as Record<string, IconType>)[name];
}
