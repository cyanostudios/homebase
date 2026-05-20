import type { ComponentType, SVGProps } from 'react';

/** App-wide icon type (lucide-react and custom SVGs) without ForwardRef $$typeof mismatch. */
export type AppIcon = ComponentType<SVGProps<SVGSVGElement> & { className?: string }>;
