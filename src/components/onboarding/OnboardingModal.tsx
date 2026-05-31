import { useNavigate } from 'react-router-dom';
import { useUserData } from '../../contexts/UserDataContext';

export function OnboardingModal() {
  const { saves, settings, updateSettings } = useUserData();
  const navigate = useNavigate();

  if (saves.length > 0 || settings.onboardingDismissed) return null;

  const handleSetUp = () => {
    updateSettings({ onboardingDismissed: true });
    navigate('/saves');
  };

  const handleSkip = () => {
    updateSettings({ onboardingDismissed: true });
  };

  return (
    <div className="onboarding-backdrop">
      <div className="onboarding-modal" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
        <h2 className="onboarding-modal__title" id="onboarding-title">
          Welcome to Stardew Companion
        </h2>
        <p className="onboarding-modal__desc">
          Set up a save profile to get personalised crop schedules, quest tracking,
          and farm planning for your playthrough. You can import directly from your
          Stardew Valley save file, or fill in the details manually.
        </p>

        <div className="onboarding-modal__actions">
          <button className="btn btn--primary" onClick={handleSetUp}>
            Set up a profile
          </button>
          <button className="btn" onClick={handleSkip}>
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
