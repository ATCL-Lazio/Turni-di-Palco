import React, { useEffect, useMemo } from 'react';
import { ListChecks, Ticket } from 'lucide-react';
import { Card } from '../ui/Card';
import { Screen } from '../ui/Screen';

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
  activeSection, onSectionChange, showTurns, showActivities, turnsView, activitiesView,
}: ActivitiesHubProps) {
  const resolvedSection = useMemo<ActivitiesHubSection | null>(() => {
    if (showTurns && showActivities) return activeSection;
    if (showTurns) return 'turns';
    if (showActivities) return 'activities';
    return null;
  }, [activeSection, showActivities, showTurns]);

  useEffect(() => {
    if (resolvedSection && resolvedSection !== activeSection) {
      onSectionChange(resolvedSection);
    }
  }, [activeSection, onSectionChange, resolvedSection]);

  const showSwitcher = showTurns && showActivities;

  return (
    <Screen contentClassName="px-6 pt-6 pb-8 space-y-5">
      {showSwitcher && (
        <SectionSwitcher activeSection={resolvedSection} onSectionChange={onSectionChange} />
      )}

      {resolvedSection === 'turns' && turnsView}
      {resolvedSection === 'activities' && activitiesView}

      {!resolvedSection && (
        <Card className="text-center py-10">
          <p className="text-sm text-[--color-text-tertiary]">Sezione non disponibile</p>
          <p className="text-sm text-[--color-text-secondary] mt-1">
            Turni e attivita sono temporaneamente disattivati dalle feature flag.
          </p>
        </Card>
      )}
    </Screen>
  );
}

// === Sub-components ===

function SectionSwitcher({
  activeSection, onSectionChange,
}: {
  activeSection: ActivitiesHubSection | null;
  onSectionChange: (section: ActivitiesHubSection) => void;
}) {
  return (
    <div className="rounded-[14px] border border-[--color-bg-surface-hover] bg-[--color-bg-surface] p-1 grid grid-cols-2 gap-1">
      <SwitcherButton
        active={activeSection === 'turns'}
        icon={<Ticket size={16} />}
        label="Turni ATCL"
        onClick={() => onSectionChange('turns')}
      />
      <SwitcherButton
        active={activeSection === 'activities'}
        icon={<ListChecks size={16} />}
        label="Attività"
        onClick={() => onSectionChange('activities')}
      />
    </div>
  );
}

function SwitcherButton({
  active, icon, label, onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[44px] rounded-[10px] px-3 text-sm font-medium transition-colors ${
        active
          ? 'bg-[--color-gold-400] text-[--color-bg-surface]'
          : 'text-[--color-text-secondary] hover:text-white hover:bg-[--color-bg-surface-elevated]'
      }`}
    >
      <span className="inline-flex items-center gap-2 justify-center w-full">
        {icon} {label}
      </span>
    </button>
  );
}
