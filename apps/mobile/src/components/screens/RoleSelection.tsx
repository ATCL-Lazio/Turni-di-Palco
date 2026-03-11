import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Users, Lightbulb, Volume2, Package, Clipboard, ChevronRight, Star, ArrowLeft, BookOpen, ShieldCheck } from 'lucide-react';
import { Role } from '../../state/store';
import { Screen, ScreenHeader } from '../ui/Screen';

const roleIcons: Record<string, React.ElementType> = {
  attore: Users,
  luci: Lightbulb,
  fonico: Volume2,
  attrezzista: Package,
  palco: Clipboard,
  rspp: ShieldCheck,
  dramaturg: BookOpen,
};

interface RoleSelectionProps {
  roles: Role[];
  showRoleJourney?: boolean;
  onComplete: (role: Role) => void;
}

export function RoleSelection({ roles, showRoleJourney = true, onComplete }: RoleSelectionProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep(2);
  };

  if (step === 1) {
    return (
      <Screen withBottomNavPadding={false}>
        <ScreenHeader gradient={false}>
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-full mb-4">
              <Star className="text-[#f4bf4f]" size={32} />
            </div>
            <h2 className="mb-2">Scegli il tuo ruolo</h2>
            <p className="text-[#b8b2b3]">Quale professione teatrale vuoi intraprendere?</p>
          </div>
        </ScreenHeader>

        <div className="space-y-3">
          {roles.map((role) => {
            const Icon = roleIcons[role.id] ?? Users;
            return (
              <Card key={role.id} hoverable onClick={() => handleRoleSelect(role)} className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-xl flex items-center justify-center">
                  <Icon className="text-[#f4bf4f]" size={24} />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="mb-1 text-white">{role.name}</h4>
                  <p className="text-xs text-[#7a7577]">{role.focus}</p>
                </div>

                <ChevronRight className="text-[#7a7577] flex-shrink-0" size={20} />
              </Card>
            );
          })}
        </div>
      </Screen>
    );
  }

  if (step === 2 && selectedRole) {
    const Icon = roleIcons[selectedRole.id] ?? Users;

    return (
      <Screen
        withBottomNavPadding={false}
        className="relative items-start justify-start"
        contentClassName="relative w-full flex-1 px-6 pt-8 pb-[calc(env(safe-area-inset-bottom,_0px)+32px)] space-y-0 box-border"
      >
        <div className="flex h-full flex-col">
          <button
            type="button"
            onClick={() => setStep(1)}
            className="flex items-center justify-center size-[44px] text-[#f4bf4f]"
            aria-label="Indietro"
          >
            <ArrowLeft size={24} />
          </button>

          <div className="mt-4 text-center mb-4">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-2xl mb-4 shadow-lg">
              <Icon className="text-[#f4bf4f]" size={40} />
            </div>
            <h2 className="mb-3">{selectedRole.name}</h2>
            <p className="text-[#b8b2b3] px-4">{selectedRole.focus}</p>
          </div>

          <Card className="mb-4">
            <h4 className="mb-4 text-[#f4bf4f]">Caratteristiche principali</h4>

            <div className="space-y-4">
              {Object.entries(selectedRole.stats).map(([key, value]) => (
                <div key={key}>
                  <div className="flex justify-between mb-2">
                    <span className="text-[#b8b2b3] capitalize">
                      {key === 'presence' ? 'Presenza scenica' : key === 'precision' ? 'Precisione' : key === 'leadership' ? 'Leadership' : 'Creatività'}
                    </span>
                    <span className="text-white">{value}/100</span>
                  </div>
                  <div className="h-2 bg-[#241f20] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#e6a23c] to-[#f4bf4f] rounded-full transition-all duration-500"
                      style={{ width: `${value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {showRoleJourney && selectedRole.profile?.journey ? (
            <Card className="mb-4 border border-[#f4bf4f]/20 bg-[#1a1617]">
              <div className="space-y-3">
                {selectedRole.profile.journey.eyebrow ? (
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#f4bf4f]">
                    {selectedRole.profile.journey.eyebrow}
                  </p>
                ) : null}
                <div>
                  <h4 className="text-white">{selectedRole.profile.journey.headline}</h4>
                  <p className="mt-1 text-sm text-[#b8b2b3]">{selectedRole.profile.journey.summary}</p>
                </div>
                {(selectedRole.profile.journey.objectives ?? []).length ? (
                  <div className="space-y-2">
                    {(selectedRole.profile.journey.objectives ?? []).slice(0, 3).map((objective) => (
                      <p key={objective} className="text-sm text-[#f7f3f4]">
                        • {objective}
                      </p>
                    ))}
                  </div>
                ) : null}
                {(selectedRole.profile.journey.starterBadgeLabels ?? []).length ? (
                  <div className="flex flex-wrap gap-2">
                    {(selectedRole.profile.journey.starterBadgeLabels ?? []).map((badgeLabel) => (
                      <span
                        key={badgeLabel}
                        className="rounded-full border border-[#f4bf4f]/20 bg-[#241f20] px-3 py-1 text-xs text-[#f4bf4f]"
                      >
                        {badgeLabel}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <Button variant="primary" size="lg" fullWidth onClick={() => onComplete(selectedRole)}>
            Conferma ruolo e continua
          </Button>
        </div>
      </Screen>
    );
  }

  return null;
}
