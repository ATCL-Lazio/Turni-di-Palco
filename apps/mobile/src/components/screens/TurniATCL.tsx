import React, { useMemo } from 'react';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ScanQRCard } from '../ScanQRCard';
import { QrCode, MapPin, Calendar, TrendingUp, Theater } from 'lucide-react';
import { TurnRecord, Role, RoleId } from '../../state/store';

interface TurniATCLProps {
  turns: TurnRecord[];
  roles: Role[];
  onScanQR: () => void;
}

export function TurniATCL({ turns, roles, onScanQR }: TurniATCLProps) {
  const stats = useMemo(() => {
    const totalXp = turns.reduce((acc, turn) => acc + turn.rewards.xp, 0);
    const theatreCount = new Set(turns.map((turn) => turn.theatre)).size;
    const totalTurns = turns.length;
    return { totalXp, theatreCount, totalTurns };
  }, [turns]);

  const resolveRoleName = (roleId: RoleId) =>
    roles.find((role) => role.id === roleId)?.name ?? 'Ruolo';
  const sortedTurns = useMemo(() => [...turns].sort((a, b) => b.createdAt - a.createdAt), [turns]);

  return (
    <div
      className="min-h-screen app-gradient"
      style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 96px)' }}
    >
      {/* Header */}
      <div className="bg-gradient-to-b from-[#2d0a0f] to-[#0f0d0e] p-6 pb-8">
        <div className="w-full max-w-md mx-auto">
          <h2 className="text-white mb-2" style={{ margin: "auto 0 20px" }}>Turni ATCL</h2>
          <p className="text-[#b8b2b3]">
            I tuoi eventi teatrali registrati
          </p>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="w-full max-w-md mx-auto px-6 space-y-6 pt-6 pb-8">
        {/* Scan Button */}
        <ScanQRCard onScanQR={onScanQR} />
        
        {/* Stats Summary */}
        <Card>
          <h4 className="text-white mb-4">Statistiche totali</h4>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#a82847] to-[#6b1529] rounded-lg flex items-center justify-center mx-auto mb-2">
                <Theater className="text-[#f4bf4f]" size={20} />
              </div>
              <p className="text-2xl text-white mb-1">{stats.totalTurns}</p>
              <p className="text-xs text-[#b8b2b3]">Turni totali</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-gradient-to-br from-[#e6a23c] to-[#f4bf4f] rounded-lg flex items-center justify-center mx-auto mb-2">
                <TrendingUp className="text-[#0f0d0e]" size={20} />
              </div>
              <p className="text-2xl text-[#f4bf4f] mb-1">{stats.totalXp}</p>
              <p className="text-xs text-[#b8b2b3]">XP sul campo</p>
            </div>
            <div>
              <div className="w-10 h-10 bg-[#241f20] rounded-lg flex items-center justify-center mx-auto mb-2">
                <MapPin className="text-[#f4bf4f]" size={20} />
              </div>
              <p className="text-2xl text-white mb-1">{stats.theatreCount}</p>
              <p className="text-xs text-[#b8b2b3]">Teatri</p>
            </div>
          </div>
        </Card>
        
        {/* Turni List */}
        <div>
          <h3 className="text-white mb-4">Storia turni</h3>
          
          {sortedTurns.length > 0 ? (
            <div className="space-y-3">
              {sortedTurns.map((turno) => (
                <Card key={turno.id} hoverable>
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0 w-12 h-12 bg-[#241f20] rounded-lg flex items-center justify-center">
                      <Theater className="text-[#f4bf4f]" size={24} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white mb-1">{turno.eventName}</h4>
                      
                      <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mb-2">
                        <MapPin size={14} />
                        <span>{turno.theatre}</span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm text-[#b8b2b3] mb-3">
                        <Calendar size={14} />
                        <span>{turno.date} · {turno.time}</span>
                      </div>
                      
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" size="sm">
                          {resolveRoleName(turno.roleId)}
                        </Badge>
                        <Badge variant="gold" size="sm">
                          +{turno.rewards.xp} XP
                        </Badge>
                        <Badge variant="success" size="sm">
                          +{turno.rewards.reputation} Rep
                        </Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            // Empty State
            <Card className="text-center py-12">
              <div className="w-16 h-16 bg-[#241f20] rounded-full flex items-center justify-center mx-auto mb-4">
                <QrCode className="text-[#7a7577]" size={32} />
              </div>
              <h4 className="text-white mb-2">Nessun turno registrato</h4>
              <p className="text-[#b8b2b3] mb-6 max-w-xs mx-auto">
                Scansiona il QR sul tuo biglietto ATCL per registrare il tuo primo turno!
              </p>
              <Button variant="primary" onClick={onScanQR}>
                <QrCode size={18} />
                Scansiona QR
              </Button>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
