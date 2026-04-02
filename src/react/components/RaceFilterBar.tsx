import { Race } from '../../types.js';
import { getAllRaces } from '../../type-metadata.js';
import RaceIcon from './RaceIcon.js';
import styles from './RaceFilterBar.module.css';

interface RaceFilterBarProps {
  value: 'all' | Race;
  onChange: (race: 'all' | Race) => void;
}

export default function RaceFilterBar({ value, onChange }: RaceFilterBarProps) {
  const races = getAllRaces();

  return (
    <>
      {/* Desktop: icon buttons */}
      <div className={styles.buttons}>
        <button
          className={`${styles.btn}${value === 'all' ? ` ${styles.active}` : ''}`}
          onClick={() => onChange('all')}
        >🌐</button>
        {races.map(rm => (
          <button
            key={rm.id}
            className={`${styles.btn}${value === rm.id ? ` ${styles.active}` : ''}`}
            onClick={() => onChange(rm.id as Race)}
          ><RaceIcon icon={rm.icon} /></button>
        ))}
      </div>

      {/* Mobile: dropdown */}
      <select
        className={`${styles.select} ${styles.dropdown}`}
        value={value === 'all' ? 'all' : String(value)}
        onChange={e => {
          const v = e.target.value;
          onChange(v === 'all' ? 'all' : Number(v) as Race);
        }}
      >
        <option value="all">🌐 All Races</option>
        {races.map(rm => (
          <option key={rm.id} value={String(rm.id)}>
            {rm.emoji ?? rm.icon ?? ''} {rm.value}
          </option>
        ))}
      </select>
    </>
  );
}
