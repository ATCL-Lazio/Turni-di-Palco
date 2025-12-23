import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Users, Lightbulb, Volume2, Package, Clipboard, ChevronRight, Star } from 'lucide-react';
import { Role } from '../../state/store';
import { Screen, ScreenHeader } from '../ui/Screen';

const roleIcons: Record<string, React.ElementType> = {
  attore: Users,
  luci: Lightbulb,
  fonico: Volume2,
  attrezzista: Package,
  palco: Clipboard,
};

interface RoleSelectionProps {
  roles: Role[];
  onComplete: (role: Role) => void;
}

export function RoleSelection({ roles, onComplete }: RoleSelectionProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const handleRoleSelect = (role: Role) => {
    setSelectedRole(role);
    setStep(2);
  };

  if (step === 1) {
    return (
      <Screen withBottomNavPadding={false}>
        <ScreenHeader>
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
              <Card key={role.id} hoverable onClick={() => handleRoleSelect(role)} className="flex items-center gap-4 p-5">
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
        header={
          <ScreenHeader>
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-2 text-[#f4bf4f] hover:text-[#e6a23c] transition-colors"
            >
              <ChevronRight size={20} className="rotate-180" />
              <span>Cambia ruolo</span>
            </button>
          </ScreenHeader>
        }
      >
        <div className="text-center mb-4">
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

        <Button variant="primary" size="lg" fullWidth onClick={() => onComplete(selectedRole)}>
          Conferma ruolo e continua
        </Button>
      </Screen>
    );
  }

  return null;
}
