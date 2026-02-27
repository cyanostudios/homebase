import React, { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useShipping } from '../hooks/useShipping';

export const ShippingBookModal: React.FC = () => {
  const {
    isShippingBookModalOpen,
    closeBookModal,
    selectedOrderIds,
    senders,
    services,
    recentServiceIds,
    weightsKgByOrder,
    settings,
    setWeightForOrder,
    bookPostnord,
    isBooking,
  } = useShipping();

  const [senderId, setSenderId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resultSummary, setResultSummary] = useState<string | null>(null);

  const servicesById = useMemo(
    () => new Map(services.map((s) => [String(s.id), s])),
    [services],
  );
  const recentServices = useMemo(
    () =>
      recentServiceIds
        .map((id) => servicesById.get(String(id)))
        .filter(Boolean),
    [recentServiceIds, servicesById],
  );

  const handleBook = async () => {
    setError(null);
    setResultSummary(null);
    if (!senderId || !serviceId) {
      setError('Välj avsändare och tjänst innan bokning.');
      return;
    }
    try {
      const result = await bookPostnord({ senderId, serviceId });
      const success = result.results.filter((r) => !r.error).length;
      const failed = result.results.length - success;
      setResultSummary(
        `Bokning klar: ${success} lyckades, ${failed} misslyckades. Uppdatera ordern om labelknappar inte syns direkt.`,
      );
    } catch (e: any) {
      setError(e?.message || 'Kunde inte boka PostNord-frakt');
    }
  };

  return (
    <Dialog open={isShippingBookModalOpen} onOpenChange={() => closeBookModal()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Skapa fraktsedlar (PostNord)</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {error && <div className="text-sm text-red-600">{error}</div>}
          {resultSummary && <div className="text-sm text-green-700">{resultSummary}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label htmlFor="shipping-sender" className="mb-1">
                Avsändare
              </Label>
              <select
                id="shipping-sender"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                value={senderId}
                onChange={(e) => setSenderId(e.target.value)}
              >
                <option value="">Välj avsändare</option>
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="shipping-service" className="mb-1">
                Tjänst
              </Label>
              <select
                id="shipping-service"
                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white text-sm"
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
              >
                <option value="">Välj tjänst</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.code})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="mb-1">Label-format (från settings)</Label>
              <div className="h-10 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm flex items-center">
                {settings?.labelFormat || 'PDF'}
              </div>
            </div>
          </div>

          {recentServices.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">Snabbåtkomst:</span>
              {recentServices.map((s) => (
                <Button
                  key={s!.id}
                  size="sm"
                  variant="outline"
                  onClick={() => setServiceId(String(s!.id))}
                >
                  {s!.name}
                </Button>
              ))}
            </div>
          )}

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order</TableHead>
                <TableHead>Rader</TableHead>
                <TableHead>Kollin</TableHead>
                <TableHead>Vikt (kg)</TableHead>
                <TableHead>Värde</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {selectedOrderIds.map((orderId) => (
                <TableRow key={orderId}>
                  <TableCell>#{orderId}</TableCell>
                  <TableCell>—</TableCell>
                  <TableCell>1</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      value={weightsKgByOrder[orderId] ?? 0.15}
                      onChange={(e) => setWeightForOrder(orderId, Number(e.target.value))}
                    />
                  </TableCell>
                  <TableCell>—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={closeBookModal} disabled={isBooking}>
              Stäng
            </Button>
            <Button onClick={handleBook} disabled={isBooking || selectedOrderIds.length === 0}>
              {isBooking ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Bokar…
                </>
              ) : (
                'Skapa'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
