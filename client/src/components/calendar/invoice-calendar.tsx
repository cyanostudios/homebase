import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, startOfDay, addWeeks, subWeeks } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import type { Invoice, ContactAssignment, Contact } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';
import { useApp } from '@/context/app-context';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState, useMemo } from 'react';
import { getMatchStatusColor } from '@/lib/status-colors';

// This function is now handled by the shared getMatchStatusColor function

function InvoiceEvent({ invoice, onClick }: { invoice: any; onClick: () => void }) {
  // Handle both string and Date types for dateTime
  const invoiceDate = typeof invoice.dateTime === 'string' ? new Date(invoice.dateTime) : invoice.dateTime;

  // Fetch contact assignments for this invoice
  const { data: assignments } = useQuery<(ContactAssignment & { contact?: Contact })[]>({
    queryKey: [`/api/invoices/${invoice.id}/assignments`],
  });

  const colors = useMemo(() => getMatchStatusColor(assignments || []), [assignments]);
  
  return (
    <div 
      className={`mb-0.5 px-1 py-0.5 ${colors.bg} ${colors.hover} text-white rounded text-[10px] cursor-pointer border-l ${colors.border} transition-colors leading-tight`}
      onClick={onClick}
    >
      <div className="font-medium truncate">{invoice.homeTeam} vs {invoice.awayTeam}</div>
      <div className={`${colors.text} truncate`}>
        {format(invoiceDate, 'HH:mm')}
      </div>
    </div>
  );
}

type CalendarView = 'day' | 'week' | 'month';

export default function InvoiceCalendar() {
  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ['/api/invoices'],
  });
  const { openInvoicePanel } = useApp();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');

  // Get calendar data based on view
  const getCalendarData = () => {
    switch (view) {
      case 'day':
        return [currentDate];
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekDays = [];
        for (let i = 0; i < 7; i++) {
          weekDays.push(addDays(weekStart, i));
        }
        return weekDays;
      case 'month':
      default:
        const monthStart = startOfMonth(currentDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);
        const calendarDays = [];
        let day = startDate;
        while (day <= endDate) {
          calendarDays.push(day);
          day = addDays(day, 1);
        }
        return calendarDays;
    }
  };

  const calendarDays = getCalendarData();

  // Get invoices for a specific day
  const getInvoicesForDay = (date: Date) => {
    return invoices.filter(invoice => {
      const invoiceDate = typeof invoice.dateTime === 'string' ? new Date(invoice.dateTime) : invoice.dateTime;
      return isSameDay(invoiceDate, date);
    });
  };

  const navigatePrevious = () => {
    switch (view) {
      case 'day':
        setCurrentDate(addDays(currentDate, -1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(subMonths(currentDate, 1));
        break;
    }
  };

  const navigateNext = () => {
    switch (view) {
      case 'day':
        setCurrentDate(addDays(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'month':
        setCurrentDate(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => setCurrentDate(new Date());

  const getDateRangeText = () => {
    switch (view) {
      case 'day':
        return format(currentDate, 'EEEE, MMMM d, yyyy');
      case 'week':
        const weekStart = startOfWeek(currentDate);
        const weekEnd = endOfWeek(currentDate);
        return `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
      case 'month':
      default:
        return format(currentDate, 'MMMM yyyy');
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white">
        <div className="flex items-center justify-center h-[500px]">
          <div className="text-muted-foreground">Loading calendar...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white h-full flex flex-col">
      {/* Outlook-style header */}
      <div className="border-b border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={navigatePrevious}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={navigateNext}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <h1 className="text-2xl font-semibold text-gray-900">
              {getDateRangeText()}
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View selector */}
            <div className="flex items-center border border-gray-300 rounded-md">
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('day')}
                className={`rounded-none rounded-l-md border-0 ${
                  view === 'day' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                }`}
              >
                Day
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
                className={`rounded-none border-0 border-l border-r border-gray-300 ${
                  view === 'week' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                }`}
              >
                Week
              </Button>
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
                className={`rounded-none rounded-r-md border-0 ${
                  view === 'month' ? 'bg-blue-600 text-white' : 'hover:bg-gray-100'
                }`}
              >
                Month
              </Button>
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={goToToday}
              className="text-blue-600 border-blue-600 hover:bg-blue-50"
            >
              Today
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-hidden">
        {/* Week header - only show for week and month views */}
        {view !== 'day' && (
          <div className={`grid ${view === 'week' ? 'grid-cols-7' : 'grid-cols-7'} border-b border-gray-200 bg-gray-50`}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="p-3 text-sm font-medium text-gray-500 text-center">
                {isMobile ? day.charAt(0) : day}
              </div>
            ))}
          </div>
        )}

        {/* Calendar days */}
        <div className={`
          grid flex-1 auto-rows-fr
          ${view === 'day' ? 'grid-cols-1' : view === 'week' ? 'grid-cols-7' : 'grid-cols-7'}
        `}>
          {calendarDays.map((day, index) => {
            const dayInvoices = getInvoicesForDay(day);
            const isCurrentMonth = view === 'month' ? isSameMonth(day, currentDate) : true;
            const isToday = isSameDay(day, new Date());

            return (
              <div
                key={index}
                className={`
                  border-r border-b border-gray-200 p-2 bg-white relative
                  ${view === 'day' ? 'min-h-[400px]' : view === 'week' ? 'h-[150px]' : 'h-[120px]'}
                  ${!isCurrentMonth && view === 'month' ? 'bg-gray-50 text-gray-400' : ''}
                  ${isToday ? 'bg-blue-50' : ''}
                  ${isMobile ? 'h-[100px] p-1' : ''}
                `}
              >
                <div className={`
                  ${view === 'day' ? 'text-lg' : 'text-sm'} font-medium mb-2
                  ${isToday ? 'text-blue-600' : isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                `}>
                  {view === 'day' ? format(day, 'EEEE, MMMM d') : format(day, 'd')}
                </div>
                
                <div className="absolute inset-x-2 top-8 bottom-2 overflow-hidden">
                  <div className="space-y-0.5 h-full overflow-y-auto">
                    {dayInvoices.slice(0, view === 'day' ? 10 : isMobile ? 3 : 4).map((invoice) => {
                      const invoiceForPanel = {
                        ...invoice,
                        dateTime: typeof invoice.dateTime === 'string' ? invoice.dateTime : invoice.dateTime.toISOString()
                      };

                      return (
                        <InvoiceEvent
                          key={invoice.id}
                          invoice={invoice}
                          onClick={() => openInvoicePanel(invoice as any)}
                        />
                      );
                    })}

                    {dayInvoices.length > (view === 'day' ? 10 : isMobile ? 3 : 4) && (
                      <div className="text-[10px] text-gray-500 px-1 py-0.5 bg-gray-100 rounded text-center">
                        +{dayInvoices.length - (view === 'day' ? 10 : isMobile ? 3 : 4)} more
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}