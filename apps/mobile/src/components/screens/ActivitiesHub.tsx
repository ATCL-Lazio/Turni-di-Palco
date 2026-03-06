import React, { useEffect, useMemo } from 'react';
import { ListChecks, Ticket } from 'lucide-react';
import { Card } from '../ui/Card';

export type ActivitiesHubSection = 'turns' | 'activities';

interface ActivitiesHubProps {
  activeSection: ActivitiesHubSection;
  onSectionChange: (section: ActivitiesHubSection) => void;
  showTurns: boolean;
  showActivities: boolean;
  turnsView: React.ReactNode;
  activitiesView: React.ReactNode;
}

export function ActivitiesHub({
  activeSection,
  onSectionChange,
  showTurns,
  showActivities,
  turnsView,
  activitiesView,
}: ActivitiesHubProps) {
  const resolvedSection = useMemo<ActivitiesHubSection | null>(() => {
    if (showTurns && showActivities) return activeSection;
    if (showTurns) return 'turns';
    if (showActivities) return 'activities';
    return null;
  }, [activeSection, showActivities, showTurns]);

  useEffect(() => {
    if (!resolvedSection) return;
    if (resolvedSection !== activeSection) {
      onSectionChange(resolvedSection);
    }
  }, [activeSection, onSectionChange, resolvedSection]);

  const showSwitcher = showTurns && showActivities;

  return (
    <div
      className="min-h-screen"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      <div className="w-full app-content px-6 pt-6 pb-8 space-y-5">
        {showSwitcher ? (
          <div className="rounded-[14px] border border-[#2d2728] bg-[#1a1617] p-1 grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => onSectionChange('turns')}
              className={`min-h-[44px] rounded-[10px] px-3 text-sm font-medium transition-colors ${
                resolvedSection === 'turns'
                  ? 'bg-[#f4bf4f] text-[#1a1617]'
                  : 'text-[#b8b2b3] hover:text-white hover:bg-[#2a2425]'
              }`}
            >
              <span className="inline-flex items-center gap-2 justify-center w-full">
                <Ticket size={16} />
                Turni ATCL
              </span>
            </button>
            <button
              type="button"
              onClick={() => onSectionChange('activities')}
              className={`min-h-[44px] rounded-[10px] px-3 text-sm font-medium transition-colors ${
                resolvedSection === 'activities'
                  ? 'bg-[#f4bf4f] text-[#1a1617]'
                  : 'text-[#b8b2b3] hover:text-white hover:bg-[#2a2425]'
              }`}
            >
              <span className="inline-flex items-center gap-2 justify-center w-full">
                <ListChecks size={16} />
                Attività
              </span>
            </button>
          </div>
        ) : null}

        {resolvedSection === 'turns' ? turnsView : null}
        {resolvedSection === 'activities' ? activitiesView : null}

        {!resolvedSection ? (
          <Card className="text-center py-10">
            <p className="text-sm text-[#7a7577]">Sezione non disponibile</p>
            <p className="text-sm text-[#b8b2b3] mt-1">
              Turni e attivita sono temporaneamente disattivati dalle feature flag.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}

