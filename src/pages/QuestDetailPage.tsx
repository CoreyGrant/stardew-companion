import { useParams, Link } from 'react-router-dom';
import { useQuestDetail } from '../hooks/useQuestDetail';
import { usePageTitle } from '../hooks/usePageTitle';
import { Panel } from '../components/common/Panel';
import { ProgressBar } from '../components/common/ProgressBar';
import { GameLink } from '../components/common/GameLink';
import { useUserData } from '../contexts/UserDataContext';

export function QuestDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { quest, completedStepIds, toggleStep, completedCount, loading, error } =
    useQuestDetail(id);
  const { activeSave } = useUserData();
  usePageTitle(quest?.name ?? 'Quest');

  if (loading) return <div className="page-loading">Loading</div>;
  if (error) return <div className="page-error">{error}</div>;
  if (!quest) return <div className="page-error">Quest not found.</div>;

  return (
    <div className="page page--quest-detail">
      <Link to="/quests" className="back-link">← Quests</Link>
      <h1 className="page__title">{quest.name}</h1>

      {activeSave && quest.steps.length > 0 && (
        <ProgressBar value={completedCount} max={quest.steps.length} label="Progress" />
      )}

      <Panel title="Overview">
        <p>{quest.description}</p>
        {quest.giverId && (
          <p>Quest giver: <GameLink type="npc" id={quest.giverId}>{quest.giverId}</GameLink></p>
        )}
        {quest.reward && <p>Reward: <strong>{quest.reward}</strong></p>}
      </Panel>

      {!activeSave && (
        <p className="notice">
          <Link to="/saves">Create a save profile</Link> to track your progress.
        </p>
      )}

      <div className="quest-steps">
        <h2 className="section-title">Walkthrough</h2>
        {quest.steps.map((step) => {
          const done = completedStepIds.includes(step.id);
          return (
            <div key={step.id} className={`quest-step${done ? ' quest-step--done' : ''}`}>
              <label className="quest-step__label">
                <input
                  type="checkbox"
                  checked={done}
                  onChange={() => toggleStep(step.id)}
                  disabled={!activeSave}
                />
                <span className="quest-step__text">{step.text}</span>
              </label>
              {step.tip && <p className="quest-step__tip">{step.tip}</p>}
              {step.linkedNPCs.length > 0 && (
                <p className="quest-step__links">
                  {step.linkedNPCs.map((npcId) => (
                    <GameLink key={npcId} type="npc" id={npcId}>{npcId}</GameLink>
                  ))}
                </p>
              )}
              {step.linkedItems.length > 0 && (
                <p className="quest-step__links">
                  {step.linkedItems.map((itemId) => (
                    <GameLink key={itemId} type="item" id={itemId}>{itemId}</GameLink>
                  ))}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
