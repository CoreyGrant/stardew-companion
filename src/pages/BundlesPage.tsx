import { Link } from 'react-router-dom';
import { useBundles, ROOM_LABELS, ROOM_REWARDS } from '../hooks/useBundles';
import { usePageTitle } from '../hooks/usePageTitle';
import { Panel } from '../components/common/Panel';
import { GameLink } from '../components/common/GameLink';
import { useUserData } from '../contexts/UserDataContext';
import type { CommunityRoom } from '../types/game';

const ROOM_DESCRIPTIONS: Record<CommunityRoom, string> = {
  crafts_room:    'Spring forages, construction materials, and exotic crops. Restoring this room repairs the bridge to the Quarry.',
  pantry:         'Crops, quality produce, animal products, and artisan goods. Completing this room restores the Greenhouse.',
  fish_tank:      'Fish from every season, plus crab-pot catches. Completing this room removes the Glittering Boulder from the river.',
  boiler_room:    'Ores, gems, and combat drops. Completing this room repairs the Minecarts.',
  bulletin_board: 'Cooking ingredients, dye items, and field research catches. Completing this room earns special community rewards.',
  vault:          'Gold donations at increasing amounts. Completing this room repairs the Bus to Calico Desert.',
};

export function BundlesPage() {
  usePageTitle('Community Center Bundles');
  const { byRoom, toggleBundleItem } = useBundles();
  const { activeSave } = useUserData();

  return (
    <div className="page page--bundles">
      <h1 className="page__title">Community Center</h1>
      {!activeSave && (
        <p className="notice">
          <Link to="/saves">Create a save profile</Link> to track your progress.
        </p>
      )}
      <div className="bundles-grid">
      {byRoom.map(({ room, bundles, allComplete, completedCount, totalCount }) => (
        <Panel
          key={room}
          title={`${ROOM_LABELS[room as CommunityRoom]} (${completedCount}/${totalCount})${allComplete ? ' ✓' : ''}`}
          collapsible
          defaultOpen={!allComplete}
        >
          <p className="room-desc">{ROOM_DESCRIPTIONS[room as CommunityRoom]}</p>
          <div className="room-reward">
            <span className="room-reward__label">Room reward:</span>{' '}
            <span className={`room-reward__value${allComplete ? ' room-reward__value--done' : ''}`}>
              {ROOM_REWARDS[room as CommunityRoom]}
            </span>
          </div>
          {bundles.map((bundle) => {
            const isPartial = bundle.resolvedRequired < bundle.items.length;
            const collected = bundle.completedItemIds.length;
            const needed = bundle.resolvedRequired;

            return (
              <div key={bundle.id} className={`bundle${bundle.isComplete ? ' bundle--complete' : ''}`}>
                <h3 className="bundle__name">
                  {bundle.name}
                  {bundle.isComplete && <span className="bundle__complete-badge">Complete</span>}
                </h3>
                <div className="bundle__meta">
                  <span className="bundle__reward">Reward: {bundle.reward}</span>
                  {isPartial ? (
                    <span className="bundle__requirement bundle__requirement--partial">
                      Any {needed} of {bundle.items.length} items
                      {activeSave && (
                        <span className="bundle__progress">
                          {' '}· {Math.min(collected, needed)}/{needed} collected
                        </span>
                      )}
                    </span>
                  ) : needed > 1 ? (
                    <span className="bundle__requirement">All {needed} items required</span>
                  ) : null}
                </div>
                <ul className="bundle__items">
                  {bundle.items.map((bi) => {
                    const progressKey = bi.slotId ?? bi.itemId;
                    const done = bundle.completedItemIds.includes(progressKey);
                    const surplus = bundle.isComplete && !done;
                    return (
                      <li
                        key={progressKey}
                        className={`bundle-item${done ? ' bundle-item--done' : ''}${surplus ? ' bundle-item--surplus' : ''}`}
                      >
                        <label className="bundle-item__label">
                          <input
                            type="checkbox"
                            checked={done}
                            onChange={() => activeSave && toggleBundleItem(bundle.id, progressKey)}
                            disabled={!activeSave}
                          />
                          <GameLink type="item" id={bi.itemId}>
                            {bi.itemName}
                          </GameLink>
                          {bi.quantity > 1 && <span className="bundle-item__qty">×{bi.quantity}</span>}
                          {bi.quality !== undefined && bi.quality > 0 && (
                            <span className="bundle-item__quality">
                              {['', 'Silver', 'Gold', 'Iridium'][bi.quality] ?? ''}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </Panel>
      ))}
      </div>
    </div>
  );
}
