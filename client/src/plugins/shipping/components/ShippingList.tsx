import React from 'react';
import { Truck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

import { useShipping } from '../hooks/useShipping';

export const ShippingList: React.FC = () => {
  const { settings, senders, services, openShippingPanel } = useShipping();
  const configured = !!(settings?.connected && settings.bookingUrl && settings.authScheme);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button variant="outline" size="sm" onClick={() => openShippingPanel(settings)}>
          Settings
        </Button>
      </div>

      {!configured ? (
        <Card padding="lg" className="border-dashed">
          <div className="flex items-start gap-4">
            <div className="mt-1">
              <Truck className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Connect PostNord</h3>
              <p className="text-sm text-muted-foreground">
                Spara endpoint/auth och lägg till avsändare + tjänster innan du bokar från Orders.
              </p>
              <div className="mt-4">
                <Button onClick={() => openShippingPanel(null)}>Öppna inställningar</Button>
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card padding="sm" className="shadow-none">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <div className="text-sm font-medium">Connected</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Avsändare</div>
              <div className="text-sm font-medium">{senders.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Tjänster</div>
              <div className="text-sm font-medium">{services.length}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Label-läge</div>
              <div className="text-sm font-medium">{settings?.labelFormat || 'PDF'}</div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
