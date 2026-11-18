import React from 'react';
import ShadeProvider from '@/providers/shade-provider';
import type { ControlShape } from '@/providers/shade-context';
import { cn } from '@/lib/utils';

/**
 * The className is used to scope the styles of the app to the app's namespace.
 * Some components in radixUI/ShadCN need to be wrapped in a div with the className
 * in order to work correctly.
 */
export const SHADE_APP_NAMESPACES = 'shade shade-admin shade-activitypub';

/*
 * In a Ghost app, Admin's chrome floats over the edges of the app's page, and the app SDK sets how
 * far it reaches in as `--ghost-safe-area-inset-*`. Padding by them keeps the app's content clear
 * of the chrome. Anywhere else the variables aren't set, so there's no padding.
 */
const SAFE_AREA_PADDING = cn(
  'pt-[var(--ghost-safe-area-inset-top,0px)] pr-[var(--ghost-safe-area-inset-right,0px)]',
  'pb-[var(--ghost-safe-area-inset-bottom,0px)] pl-[var(--ghost-safe-area-inset-left,0px)]',
);

export interface ShadeAppProps extends React.HTMLProps<HTMLDivElement> {
  darkMode: boolean;
  controlShape?: ControlShape;
  /**
   * Admin's `admin7Design` Labs flag. Admin passes the flag's value; isolated Shade
   * previews and standalone apps default to the Admin 7 design. Removed with the flag.
   */
  admin7Design?: boolean;
}

const ShadeApp: React.FC<ShadeAppProps> = ({
  darkMode,
  controlShape,
  admin7Design = true,
  className,
  children,
  ...props
}) => {
  // After the safe area's padding, so a className's own padding wins.
  const appClassName = cn('shade', SAFE_AREA_PADDING, className);

  return (
    <div className={appClassName} {...props} data-admin7-design={admin7Design}>
      <ShadeProvider admin7Design={admin7Design} controlShape={controlShape} darkMode={darkMode}>
        {children}
      </ShadeProvider>
    </div>
  );
};

export default ShadeApp;
