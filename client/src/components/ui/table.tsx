import * as React from 'react';

import { cn } from '@/lib/utils';

const TableStyleContext = React.createContext<{ rowBorders: boolean }>({ rowBorders: true });

interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  rowBorders?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, rowBorders = true, ...props }, ref) => (
    <TableStyleContext.Provider value={{ rowBorders }}>
      <div className="relative w-full overflow-auto">
        <table
          ref={ref}
          className={cn(
            'w-full caption-bottom text-sm',
            !rowBorders &&
              '[&_thead]:border-0 [&_tbody]:border-0 [&_tr]:border-0 [&_th]:border-0 [&_td]:border-0',
            className,
          )}
          {...props}
        />
      </div>
    </TableStyleContext.Provider>
  ),
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { rowBorders } = React.useContext(TableStyleContext);
  return <thead ref={ref} className={cn(rowBorders && '[&_tr]:border-b', className)} {...props} />;
});
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => {
  const { rowBorders } = React.useContext(TableStyleContext);
  return (
    <tbody
      ref={ref}
      className={cn(rowBorders && '[&_tr:last-child]:border-0', className)}
      {...props}
    />
  );
});
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn('border-t bg-muted/50 font-medium [&>tr]:last:border-b-0', className)}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => {
    const { rowBorders } = React.useContext(TableStyleContext);
    return (
      <tr
        ref={ref}
        className={cn(
          rowBorders && 'border-b',
          'transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
          className,
        )}
        {...props}
      />
    );
  },
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      'h-12 px-4 text-left align-middle font-medium text-muted-foreground [&:has([role=checkbox])]:pr-0',
      className,
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn('p-4 align-middle [&:has([role=checkbox])]:pr-0', className)}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
));
TableCaption.displayName = 'TableCaption';

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption };
