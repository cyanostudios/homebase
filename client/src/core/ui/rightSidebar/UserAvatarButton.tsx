import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { useApp } from '@/core/api/AppContext';
import { getUserColor, getUserInitials } from '@/core/ui/topbar/helpers';
import { cn } from '@/lib/utils';

/** Colored initials ring — matches RoundIconLabelButton `xs` footprint. */
export const UserAvatarButton = React.forwardRef<
  HTMLButtonElement,
  {
    active?: boolean;
    onClick?: () => void;
    className?: string;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'>
>(function UserAvatarButton(
  { active = false, onClick, className, type = 'button', ...props },
  ref,
) {
  const { t } = useTranslation();
  const { user, getSettings } = useApp();
  const [name, setName] = useState<string | undefined>();

  useEffect(() => {
    const load = async () => {
      try {
        const settings = await getSettings('profile');
        setName(settings?.name);
      } catch {
        /* ignore */
      }
    };
    if (user) {
      void load();
    }
  }, [user, getSettings]);

  return (
    <button
      ref={ref}
      type={type}
      aria-label={t('rightSidebar.userMenu')}
      title={t('rightSidebar.userMenu')}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex h-[2.0625rem] min-w-[2.0625rem] shrink-0 items-center justify-center overflow-hidden rounded-full',
        'text-[0.65rem] font-extrabold text-white transition-[filter,box-shadow] duration-320 ease-out',
        'hover:brightness-[0.92]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        getUserColor(user?.email),
        active && 'ring-2 ring-primary ring-offset-2 ring-offset-workspace',
        className,
      )}
      {...props}
    >
      {getUserInitials(name, user?.email)}
    </button>
  );
});
