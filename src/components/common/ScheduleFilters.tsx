/**
 * ScheduleFilters
 *
 * Compact game-state condition controls used on both the Schedule and Gift
 * Guide pages. Values pre-populate from the active save but are overrideable.
 *
 * Conditions exposed:
 *   Community progress — affects CC/Joja-dependent schedule variants and
 *                        whether the bus is repaired (derived automatically)
 *   Married to         — selects marriage-variant schedules for that NPC
 *   Island unlocked    — selects island-visit variants
 */
import type { NPC } from '../../types/game';

const COMMUNITY_OPTIONS = [
  { value: 'none',          label: 'In progress'   },
  { value: 'cc-restored',   label: 'CC Restored'   },
  { value: 'joja-member',   label: 'Joja Member'   },
  { value: 'joja-complete', label: 'Joja Complete'  },
] as const;

interface Props {
  communityStatus:   string;
  onCommunityStatus: (v: string)  => void;
  marriedTo:         string;
  onMarriedTo:       (v: string)  => void;
  islandUnlocked:    boolean;
  onIslandUnlocked:  (v: boolean) => void;
  busRepaired:       boolean;
  onBusRepaired:     (v: boolean) => void;
  marriageableNpcs:  NPC[];
}

export function ScheduleFilters({
  communityStatus, onCommunityStatus,
  marriedTo,       onMarriedTo,
  islandUnlocked,  onIslandUnlocked,
  busRepaired,     onBusRepaired,
  marriageableNpcs,
}: Props) {
  return (
    <div className="sched-filters">

      {/* Community Centre / Joja status */}
      <div className="sched-filter">
        <span className="sched-filter__label">Community</span>
        <select
          className="sched-filter__select"
          value={communityStatus}
          onChange={e => onCommunityStatus(e.target.value)}
        >
          {COMMUNITY_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Married to */}
      <div className="sched-filter">
        <span className="sched-filter__label">Married to</span>
        <select
          className="sched-filter__select"
          value={marriedTo}
          onChange={e => onMarriedTo(e.target.value)}
        >
          <option value="">Not married</option>
          {marriageableNpcs.map(npc => (
            <option key={npc.id} value={npc.id}>{npc.name}</option>
          ))}
        </select>
      </div>

      {/* Desert bus */}
      <label className="sched-filter sched-filter--check">
        <input
          type="checkbox"
          checked={busRepaired}
          onChange={e => onBusRepaired(e.target.checked)}
        />
        <span className="sched-filter__label">Bus repaired</span>
      </label>

      {/* Ginger Island */}
      <label className="sched-filter sched-filter--check">
        <input
          type="checkbox"
          checked={islandUnlocked}
          onChange={e => onIslandUnlocked(e.target.checked)}
        />
        <span className="sched-filter__label">Island unlocked</span>
      </label>

    </div>
  );
}
