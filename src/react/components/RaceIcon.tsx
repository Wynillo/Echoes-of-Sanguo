import { GI_ICON_REGISTRY } from './giIconRegistry.js';

interface RaceIconProps {
  icon?: string;
  size?: number;
  className?: string;
}

export default function RaceIcon({ icon, size, className }: RaceIconProps) {
  if (!icon) return <>{'?'}</>;

  if (icon.startsWith('Gi')) {
    const Comp = GI_ICON_REGISTRY[icon];
    if (Comp) return <Comp size={size} className={className} />;
  }

  return <>{icon}</>;
}
