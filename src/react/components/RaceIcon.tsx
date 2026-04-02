import { resolveGiIcon } from './giIconRegistry.js';

interface RaceIconProps {
  icon?: string;
  color?: string;
  size?: string | number;
  className?: string;
}

export default function RaceIcon({ icon, color, size, className }: RaceIconProps) {
  if (!icon) return <>{'?'}</>;

  if (icon.startsWith('Gi')) {
    const Comp = resolveGiIcon(icon);
    if (Comp) {
      const style: React.CSSProperties = {
        display: 'inline-block',
        verticalAlign: 'middle',
        ...(color && {
          color,
          filter: `drop-shadow(0 0 2px rgba(0,0,0,0.8)) drop-shadow(0 0 5px ${color}88)`,
        }),
      };
      return <Comp size={size} className={className} style={style} />;
    }
  }

  return <>{icon}</>;
}
