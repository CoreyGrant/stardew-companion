import { Link } from 'react-router-dom';
import { Panel } from '../components/common/Panel';
import { usePageTitle } from '../hooks/usePageTitle';
import { BirthdayWidget } from '../components/common/BirthdayWidget';
import { useUserData } from '../contexts/UserDataContext';

const FEATURE_GROUPS = [
  {
    label: 'Reference',
    links: [
      { to: '/items',     label: 'Items',     desc: 'Browse crops, fish, minerals and more', emoji: '🎒' },
      { to: '/crops',     label: 'Crops',     desc: 'Season guide, growth times, gold/day',  emoji: '🌾' },
      { to: '/fish',      label: 'Fish',      desc: 'Where and when to catch every fish',    emoji: '🐟' },
      { to: '/fish-pond', label: 'Fish Pond', desc: 'Pond produce, roe chances, pop quests', emoji: '🐠' },
      { to: '/foraging',  label: 'Foraging',  desc: 'Wild items by season and location',      emoji: '🍄' },
      { to: '/shops',     label: 'Shops',     desc: 'Browse all vendor inventories and prices', emoji: '🏪' },
      { to: '/recipes',   label: 'Recipes',   desc: 'All 81 cooking recipes and ingredients',emoji: '🍳' },
      { to: '/machines',  label: 'Machines',  desc: 'Keg, Preserves Jar, Furnace outputs',   emoji: '⚙️' },
      { to: '/museum',    label: 'Museum',    desc: 'Track artifact & mineral donations',     emoji: '🏛️' },
      { to: '/calendar',  label: 'Calendar',  desc: 'Birthdays, festivals, planting dates',  emoji: '📅' },
    ],
  },
  {
    label: 'Villagers',
    links: [
      { to: '/characters', label: 'Characters',   desc: 'Villager profiles and schedules',      emoji: '👥' },
      { to: '/schedule',   label: 'Schedule',     desc: 'Find any NPC at a given time',         emoji: '🗓' },
      { to: '/gifts',      label: 'Gift Guide',   desc: 'What every villager loves and likes',  emoji: '🎁' },
    ],
  },
  {
    label: 'Progression',
    links: [
      { to: '/quests',   label: 'Quests',    desc: 'Walkthroughs and progress tracking', emoji: '📜' },
      { to: '/bundles',  label: 'Bundles',   desc: 'Community Center bundle tracker',    emoji: '🏛' },
      { to: '/saves',    label: 'Saves',     desc: 'Manage your playthroughs',           emoji: '💾' },
    ],
  },
  {
    label: 'Planning',
    links: [
      { to: '/farm-planner', label: 'Farm Planner',    desc: 'Design your farm layout',        emoji: '🏡' },
      { to: '/island-farm',  label: 'Island Farm',     desc: 'Plan your Ginger Island layout',  emoji: '🏝' },
    ],
  },
];

export function HomePage() {
  usePageTitle('Home');
  const { activeSave, settings } = useUserData();

  return (
    <div className="page page--home">
      <h1 className="page__title">Stardew Companion</h1>
      <p className="page__subtitle">Your complete guide to Stardew Valley 1.6</p>

      {settings.tailorToSave && activeSave && (
        <Panel className="home-save-summary" title={`Playing as: ${activeSave.name}`}>
          <div className="home-save-body">
            <ul className="save-summary__list">
              <li>Farm: {activeSave.farmType.replace(/[-_]/g, ' ')}</li>
              <li>
                {activeSave.season
                  ? `${activeSave.season.charAt(0).toUpperCase() + activeSave.season.slice(1)} Day ${activeSave.day ?? 1}, Year ${activeSave.year}`
                  : `Year ${activeSave.year}`}
              </li>
              {activeSave.marriedTo && <li>Married to: {activeSave.marriedTo}</li>}
              <li>Farming Lv. {activeSave.skills.farming}</li>
            </ul>
            <BirthdayWidget activeSave={activeSave} />
          </div>
        </Panel>
      )}

      <div className="home-groups">
        {FEATURE_GROUPS.map((group) => (
          <div key={group.label} className="home-group">
            <h2 className="home-group__label">{group.label}</h2>
            <div className="home-grid">
              {group.links.map((link) => (
                <Link key={link.to} to={link.to} className="home-card">
                  <span className="home-card__emoji" aria-hidden="true">{link.emoji}</span>
                  <span className="home-card__label">{link.label}</span>
                  <span className="home-card__desc">{link.desc}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
