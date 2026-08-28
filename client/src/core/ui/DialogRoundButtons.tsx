import type { AppIcon } from '@/types/icons';
import { Check, Send, Trash2, X } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import {
  RoundIconLabelButton,
  type RoundIconLabelButtonProps,
  type RoundIconLabelButtonVariant,
} from '@/components/ui/round-icon-label-button';

type DialogRoundButtonProps = Omit<
  RoundIconLabelButtonProps,
  'icon' | 'label' | 'alwaysExpanded' | 'variant'
> & {
  label?: string;
};

export function DialogCancelButton({ label, ...props }: DialogRoundButtonProps) {
  const { t } = useTranslation();
  return (
    <RoundIconLabelButton
      icon={X}
      label={label ?? t('common.cancel')}
      variant="secondary"
      alwaysExpanded
      {...props}
    />
  );
}

export function DialogCloseButton({ label, ...props }: DialogRoundButtonProps) {
  const { t } = useTranslation();
  return (
    <RoundIconLabelButton
      icon={X}
      label={label ?? t('common.close')}
      variant="secondary"
      alwaysExpanded
      {...props}
    />
  );
}

export function DialogSaveButton({ label, ...props }: DialogRoundButtonProps) {
  const { t } = useTranslation();
  return (
    <RoundIconLabelButton
      icon={Check}
      label={label ?? t('common.save')}
      variant="success"
      alwaysExpanded
      {...props}
    />
  );
}

export function DialogDeleteButton({ label, ...props }: DialogRoundButtonProps) {
  const { t } = useTranslation();
  return (
    <RoundIconLabelButton
      icon={Trash2}
      label={label ?? t('common.delete')}
      variant="danger"
      alwaysExpanded
      {...props}
    />
  );
}

export function DialogSendButton({ label, ...props }: DialogRoundButtonProps) {
  const { t } = useTranslation();
  return (
    <RoundIconLabelButton
      icon={Send}
      label={label ?? t('bulk.sendMessageSend', { defaultValue: 'Send' })}
      variant="primary"
      alwaysExpanded
      {...props}
    />
  );
}

export type DialogActionButtonProps = DialogRoundButtonProps & {
  variant?: RoundIconLabelButtonVariant;
  icon?: AppIcon;
};

export function DialogActionButton({
  label,
  variant = 'primary',
  icon = Check,
  ...props
}: DialogActionButtonProps) {
  return (
    <RoundIconLabelButton
      icon={icon}
      label={label ?? ''}
      variant={variant}
      alwaysExpanded
      {...props}
    />
  );
}

export function AlertDialogRoundCancel({
  close = false,
  ...props
}: DialogRoundButtonProps & { close?: boolean }) {
  const ButtonComponent = close ? DialogCloseButton : DialogCancelButton;
  return (
    <AlertDialogCancel asChild>
      <ButtonComponent {...props} />
    </AlertDialogCancel>
  );
}

export function AlertDialogRoundClose(props: DialogRoundButtonProps) {
  return (
    <AlertDialogCancel asChild>
      <DialogCloseButton {...props} />
    </AlertDialogCancel>
  );
}

export function AlertDialogRoundAction({
  variant = 'primary',
  icon = Check,
  label,
  ...props
}: DialogActionButtonProps) {
  return (
    <AlertDialogAction asChild>
      <DialogActionButton variant={variant} icon={icon} label={label} {...props} />
    </AlertDialogAction>
  );
}

export function AlertDialogRoundSave(props: DialogRoundButtonProps) {
  return (
    <AlertDialogAction asChild>
      <DialogSaveButton {...props} />
    </AlertDialogAction>
  );
}

export function AlertDialogRoundDelete(props: DialogRoundButtonProps) {
  return (
    <AlertDialogAction asChild>
      <DialogDeleteButton {...props} />
    </AlertDialogAction>
  );
}
