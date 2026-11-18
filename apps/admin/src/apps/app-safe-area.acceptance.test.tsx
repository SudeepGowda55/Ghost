import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { page } from 'vitest/browser';
import { type AppOverlay, ShadeApp } from '@tryghost/shade/app';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  Dialog,
  DialogContent,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DialogDescription,
  DialogTitle,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from '@tryghost/shade/components';
import { renderInApp } from '@test-utils/acceptance';

/*
 * Shade's dialogs and sheets in an app's safe area, which the app SDK sets on `<html>` as
 * `--ghost-safe-area-inset-*`. In an app's overlay, Admin shows only the safe area, so whatever
 * reaches past it is cut off. A fake overlay in this document stands in for the app's.
 */

const WINDOW = { width: 1280, height: 720 };
// Admin 7 with its navigation pinned: the top bar, the navigation, and the app's footer.
const INSETS = { top: 44, right: 8, bottom: 65, left: 293 };

const setInsets = (insets: typeof INSETS | undefined) => {
  for (const edge of ['top', 'right', 'bottom', 'left'] as const) {
    const name = `--ghost-safe-area-inset-${edge}`;
    if (insets) {
      document.documentElement.style.setProperty(name, `${insets[edge]}px`);
    } else {
      document.documentElement.style.removeProperty(name);
    }
  }
};

let root: HTMLDivElement;
const overlay: AppOverlay = {
  container: () => root,
  hold: () => ({ setOpen: () => {}, release: () => {} }),
};

/** Waits out the opening animations, which scale and slide what they open. */
const settle = () =>
  new Promise((resolve) => {
    setTimeout(resolve, 700);
  });

const box = (element: Element) => element.getBoundingClientRect();
const byRole = (role: string) => document.querySelector(`[role=${role}]`)!;

/** Whether `inner` lies within the window's safe area, give or take a pixel. */
const insideSafeArea = (inner: DOMRect) => ({
  top: inner.top >= INSETS.top - 1,
  right: inner.right <= WINDOW.width - INSETS.right + 1,
  bottom: inner.bottom <= WINDOW.height - INSETS.bottom + 1,
  left: inner.left >= INSETS.left - 1,
});
const INSIDE = { top: true, right: true, bottom: true, left: true };

beforeEach(async () => {
  await page.viewport(WINDOW.width, WINDOW.height);
  root = document.createElement('div');
  document.body.append(root);
});

afterEach(() => {
  setInsets(undefined);
  root.remove();
});

describe('outside an app, with no safe area', () => {
  it('leaves a dialog centred on the window, 8vmin from its top', async () => {
    await renderInApp(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const dialog = box(byRole('dialog'));
    expect(Math.round(dialog.left + dialog.width / 2)).toBe(WINDOW.width / 2);
    expect(Math.round(dialog.top)).toBe(Math.round(0.08 * WINDOW.height));
  });

  it('leaves an alert dialog centred on the window, a fifth of the way down', async () => {
    await renderInApp(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
        </AlertDialogContent>
      </AlertDialog>,
    );
    await settle();

    const dialog = box(byRole('alertdialog'));
    expect(Math.round(dialog.left + dialog.width / 2)).toBe(WINDOW.width / 2);
    expect(Math.round(dialog.top + 0.2 * dialog.height)).toBe(Math.round(0.2 * WINDOW.height));
  });

  it('leaves a dialog that scrolls as a page does scrolling the whole window', async () => {
    await renderInApp(
      <Dialog open>
        <DialogContent scroll="overlay">
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <div style={{ height: 2000 }} />
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const scroller = box(document.querySelector('[data-slot=dialog-overlay]')!);
    expect([scroller.top, scroller.right, scroller.bottom, scroller.left]).toEqual([
      0,
      WINDOW.width,
      WINDOW.height,
      0,
    ]);
    const dialog = box(byRole('dialog'));
    expect(Math.round(dialog.top)).toBe(Math.round(0.08 * WINDOW.height));
  });

  it('leaves a left sheet against the window’s left edge, its full height', async () => {
    await renderInApp(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await settle();

    const sheet = box(byRole('dialog'));
    expect([sheet.top, sheet.left, sheet.bottom]).toEqual([0, 0, WINDOW.height]);
  });

  it('leaves a sheet against the window’s right edge, its full height, with its close button', async () => {
    await renderInApp(
      <Sheet open>
        <SheetContent>
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await settle();

    const sheet = box(byRole('dialog'));
    expect([sheet.top, sheet.right, sheet.bottom]).toEqual([0, WINDOW.width, WINDOW.height]);
    const close = box(page.getByRole('button', { name: 'Close' }).element());
    expect([close.top, WINDOW.width - close.right]).toEqual([16, 16]);
  });
});

describe('in an app’s overlay, with Admin 7’s safe area', () => {
  beforeEach(() => setInsets(INSETS));

  const inOverlay = (children: React.ReactNode) =>
    renderInApp(
      <ShadeApp darkMode={false} overlay={overlay}>
        {children}
      </ShadeApp>,
    );

  it('keeps a dialog centred on the window while it fits', async () => {
    await inOverlay(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const dialog = box(byRole('dialog'));
    expect(root.contains(byRole('dialog'))).toBe(true);
    expect(Math.round(dialog.left + dialog.width / 2)).toBe(WINDOW.width / 2);
    // Where Admin's own sit, as it fits there.
    expect(Math.round(dialog.top)).toBe(Math.round(0.08 * WINDOW.height));
    expect(insideSafeArea(dialog)).toEqual(INSIDE);
  });

  it('moves a wide dialog only as far as it must, and bounds a tall one, which scrolls', async () => {
    await inOverlay(
      <Dialog open>
        <DialogContent className="max-w-4xl">
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <div style={{ height: 2000 }} />
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const element = byRole('dialog');
    const dialog = box(element);
    expect(Math.round(dialog.left)).toBe(INSETS.left);
    expect(insideSafeArea(dialog)).toEqual(INSIDE);
    expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
    // A little way in from the safe area's bottom.
    expect(dialog.bottom).toBeLessThan(WINDOW.height - INSETS.bottom);
  });

  it('scrolls a dialog that scrolls as a page does inside the safe area', async () => {
    await inOverlay(
      <Dialog open>
        <DialogContent className="max-w-4xl" scroll="overlay">
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <div style={{ height: 2000 }} />
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const scroller = box(document.querySelector('[data-slot=dialog-scroller]')!);
    expect([scroller.top, scroller.right, scroller.bottom, scroller.left]).toEqual([
      INSETS.top,
      WINDOW.width - INSETS.right,
      WINDOW.height - INSETS.bottom,
      INSETS.left,
    ]);
    const dialog = box(byRole('dialog'));
    expect(dialog.left).toBeGreaterThanOrEqual(INSETS.left);
    expect(dialog.right).toBeLessThanOrEqual(WINDOW.width - INSETS.right);
    expect(Math.round(dialog.top)).toBe(Math.max(Math.round(0.08 * WINDOW.height), INSETS.top));
  });

  it('keeps a tall alert dialog between the safe area’s top and bottom', async () => {
    await inOverlay(
      <AlertDialog open>
        <AlertDialogContent>
          <AlertDialogTitle>Title</AlertDialogTitle>
          <AlertDialogDescription>Description</AlertDialogDescription>
          <div style={{ height: 2000 }} />
        </AlertDialogContent>
      </AlertDialog>,
    );
    await settle();

    expect(insideSafeArea(box(byRole('alertdialog')))).toEqual(INSIDE);
  });

  it.each(['top', 'right', 'bottom', 'left'] as const)(
    'docks a %s sheet at the safe area’s edge, with its close button on it',
    async (side) => {
      await inOverlay(
        <Sheet open>
          <SheetContent side={side}>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>Description</SheetDescription>
          </SheetContent>
        </Sheet>,
      );
      await settle();

      const sheet = box(byRole('dialog'));
      expect(insideSafeArea(sheet)).toEqual(INSIDE);
      const edge = {
        top: sheet.top - INSETS.top,
        right: WINDOW.width - INSETS.right - sheet.right,
        bottom: WINDOW.height - INSETS.bottom - sheet.bottom,
        left: sheet.left - INSETS.left,
      };
      expect(Math.round(edge[side])).toBe(0);
      const close = box(page.getByRole('button', { name: 'Close' }).element());
      expect(close.left).toBeGreaterThanOrEqual(sheet.left);
      expect(close.right).toBeLessThanOrEqual(sheet.right);
      expect(close.top).toBeGreaterThanOrEqual(sheet.top);
      expect(close.bottom).toBeLessThanOrEqual(sheet.bottom);
    },
  );

  it('bounds a tall top sheet by the safe area, which it scrolls inside', async () => {
    await inOverlay(
      <Sheet open>
        <SheetContent side="top">
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Description</SheetDescription>
          <div style={{ height: 2000 }} />
        </SheetContent>
      </Sheet>,
    );
    await settle();

    const element = byRole('dialog');
    expect(insideSafeArea(box(element))).toEqual(INSIDE);
    expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
  });

  it('keeps the close button on a sheet that opens in the overlay without holding it', async () => {
    await inOverlay(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <Sheet modal={false} open>
            <SheetContent side="left">
              <SheetTitle>Sheet</SheetTitle>
              <SheetDescription>Description</SheetDescription>
            </SheetContent>
          </Sheet>
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const sheet = [...document.querySelectorAll('[role=dialog]')].find((element) =>
      element.textContent?.includes('Sheet'),
    )!;
    expect(root.contains(sheet)).toBe(true);
    const sheetBox = box(sheet);
    const close = box(sheet.querySelector('button')!);
    expect(close.left).toBeGreaterThanOrEqual(sheetBox.left);
    expect(close.right).toBeLessThanOrEqual(sheetBox.right);
    expect(close.top).toBeGreaterThanOrEqual(sheetBox.top);
  });

  it('lets a long menu scroll within the safe area, so its last item can be reached', async () => {
    await inOverlay(
      <DropdownMenu open>
        <DropdownMenuTrigger style={{ position: 'fixed', left: 600, top: 300 }}>
          Menu
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {Array.from({ length: 40 }, (_, index) => (
            <DropdownMenuItem key={index}>Item {index + 1}</DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>,
    );
    await settle();

    const menu = byRole('menu');
    expect(insideSafeArea(box(menu))).toEqual(INSIDE);
    expect(menu.scrollHeight).toBeGreaterThan(menu.clientHeight);
  });

  it('opens a popover above its trigger rather than beneath the safe area’s bottom', async () => {
    await inOverlay(
      <Popover open>
        <PopoverTrigger
          style={{ position: 'fixed', left: 600, top: WINDOW.height - INSETS.bottom - 30 }}
        >
          Open
        </PopoverTrigger>
        <PopoverContent>
          <div style={{ height: 10 }}>Popover</div>
        </PopoverContent>
      </Popover>,
    );
    await settle();

    const content = page.getByText('Popover').element().closest('[role=dialog]')!;
    const popover = box(content);
    const trigger = box(page.getByText('Open').element());
    // It would fit below its trigger in the window, but not in the safe area.
    expect(WINDOW.height - trigger.bottom).toBeGreaterThan(popover.height + 8);
    expect(content.getAttribute('data-side')).toBe('top');
    expect(popover.bottom).toBeLessThanOrEqual(trigger.top);
  });
});

describe('in an app’s page, where a dialog renders when Admin has no overlay for it', () => {
  beforeEach(() => setInsets(INSETS));

  const inPage = (children: React.ReactNode) =>
    renderInApp(
      <ShadeApp darkMode={false} overlay={{ ...overlay, container: () => undefined }}>
        {children}
      </ShadeApp>,
    );

  it('keeps a tall dialog inside the safe area, scrolling inside', async () => {
    await inPage(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <div style={{ height: 2000 }} />
        </DialogContent>
      </Dialog>,
    );
    await settle();

    const element = byRole('dialog');
    expect(root.contains(element)).toBe(false);
    expect(insideSafeArea(box(element))).toEqual(INSIDE);
    expect(element.scrollHeight).toBeGreaterThan(element.clientHeight);
  });

  it('lets a dialog that scrolls as a page does scroll its end clear of the chrome', async () => {
    await inPage(
      <Dialog open>
        <DialogContent className="max-w-4xl" scroll="overlay">
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <div style={{ height: 2000 }} />
        </DialogContent>
      </Dialog>,
    );
    await settle();

    // Its backdrop covers the whole page, under the chrome too.
    const backdrop = box(document.querySelector('[data-slot=dialog-overlay]')!);
    expect([backdrop.top, backdrop.right, backdrop.bottom, backdrop.left]).toEqual([
      0,
      WINDOW.width,
      WINDOW.height,
      0,
    ]);
    const scroller = document.querySelector('[data-slot=dialog-scroller]')!;
    // Its scrollbar runs down the safe area's edge, not beneath the chrome.
    const scrollerBox = box(scroller);
    expect([scrollerBox.top, scrollerBox.right, scrollerBox.bottom, scrollerBox.left]).toEqual([
      INSETS.top,
      WINDOW.width - INSETS.right,
      WINDOW.height - INSETS.bottom,
      INSETS.left,
    ]);
    scroller.scrollTop = scroller.scrollHeight;
    const dialog = box(byRole('dialog'));
    expect(dialog.left).toBeGreaterThanOrEqual(INSETS.left);
    expect(dialog.right).toBeLessThanOrEqual(WINDOW.width - INSETS.right);
    expect(dialog.bottom).toBeLessThanOrEqual(WINDOW.height - INSETS.bottom);
  });

  it('keeps a sheet’s close button on the sheet', async () => {
    const noOverlay: AppOverlay = { ...overlay, container: () => undefined };
    await renderInApp(
      <ShadeApp darkMode={false} overlay={noOverlay}>
        <Sheet open>
          <SheetContent>
            <SheetTitle>Title</SheetTitle>
            <SheetDescription>Description</SheetDescription>
          </SheetContent>
        </Sheet>
      </ShadeApp>,
    );
    await settle();

    const element = byRole('dialog');
    expect(root.contains(element)).toBe(false);
    const sheet = box(element);
    const close = box(page.getByRole('button', { name: 'Close' }).element());
    expect(close.right).toBeLessThanOrEqual(sheet.right);
    expect(close.top).toBeGreaterThanOrEqual(sheet.top);
  });

  it('keeps a side sheet no wider than a narrow safe area', async () => {
    setInsets({ ...INSETS, left: 1000 });
    await inPage(
      <Sheet open>
        <SheetContent side="left">
          <SheetTitle>Title</SheetTitle>
          <SheetDescription>Description</SheetDescription>
        </SheetContent>
      </Sheet>,
    );
    await settle();

    const sheet = box(byRole('dialog'));
    expect(sheet.left).toBe(1000);
    expect(sheet.right).toBeLessThanOrEqual(WINDOW.width - INSETS.right);
  });

  it('keeps a dialog inside the safe area in an app that passes no overlay to ShadeApp', async () => {
    await renderInApp(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Description</DialogDescription>
          <div style={{ height: 2000 }} />
        </DialogContent>
      </Dialog>,
    );
    await settle();

    expect(insideSafeArea(box(byRole('dialog')))).toEqual(INSIDE);
  });
});
