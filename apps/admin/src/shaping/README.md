# Help layout prototype

**Prototype branch only. Never merge this folder, the `main.tsx` hook, or the
lines marked `SHAPING PROTOTYPE ONLY` in the layout files.**

Compares where in-app Help lives in Admin. The Help app itself is unchanged:
it's the real one, from production, in Admin's side panel. Only how Admin
places that panel differs between concepts.

## Setting up

1. In Labs → Private features, turn on **In-app support**. For the Admin 7
   versions, turn on **Admin 7 design** too. The prototype never turns flags on
   itself.
2. Reload, then click **Help** (the left navigation in classic Admin, the
   account menu in Admin 7).

On Ghost(Pro) a host script adds the Help app's loader. A local Ghost has none,
so `load-help-app.ts` adds the same loader, from `sup.ghost.org`. Search and
articles are real. The contact form can't send from a local Ghost, which the
app's API turns away.

## Switching options

Move the pointer to the bottom-right corner for the beaker (`menu.tsx`,
`concepts.ts`). The menu's lists are picked separately, so any layout can be tried with any
design and access point. A pick applies live, with Help left open as it
was, and is remembered in this browser.

**Layout**: how Help's panel sits with the page.

| Option   | The panel                                                                                                                                                                                                         |
| -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current  | Beside the page, which gets narrower                                                                                                                                                                              |
| Window   | A smaller card in the bottom-right corner                                                                                                                                                                         |
| Floating | A full-height card over the right of the page; from 1800px wide there's room, and it docks beside the page. Docked, it grows into the space a wider window leaves beside the page, up to 639px (655px with Roomy) |

An always-floating full-height panel was tried and dropped: docking when
there's room does the same on narrow windows and better on wide ones.

**Design**: the panel's own width and padding.

| Option  | Width beside the page   | Floating window | Room around Help                               |
| ------- | ----------------------- | --------------- | ---------------------------------------------- |
| Current | 316px, the navigation's | 380 × 640px     | None                                           |
| Roomy   | 400px                   | 440 × 680px     | Help's content sits 24px from the panel's edge |

Expanding is main's in both: the panel covers the page, up to the navigation.
Three other expanded sizes were tried in Roomy and dropped (a 655px cap, a
1280px cap, and the whole screen over the navigation). Help lays itself out by
its frame's width, which Admin can't change: from 640px wide its gutter grows
from 16px to 40px, and past 1280px its content stops growing and is centred.
Changing how Help looks expanded is a change to the Help app.

Help is a page from another site in a frame, with a 16px gutter of its own
that Admin can't change. Roomy adds 8px around the frame to make 24px. A true
24px gutter is a change to the Help app (`TryGhost/support-app`), where its
dividers and scrollbar would still reach the panel's edge; here they stop 8px
short. Floating docks from 1884px with Roomy, as the wider panel
needs that much more.

**Access**: where Help is opened from. The panel shows where it can be
opened from, so the access point also decides which screens it shows on.

| Option       | Help is in                                                                                                                                   | The panel shows                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Current      | The main navigation (the account menu in Admin 7)                                                                                            | Where the main navigation does: not Settings or the editor |
| Top bar      | The Admin 7 top bar, in place of the account menu. Classic Admin keeps the main navigation's link and adds one under the Settings navigation | On every desktop screen                                    |
| Top bar slim | As Top bar, with a calmer Admin 7 top bar: a short month (Nov), long numbers abbreviated (128k), and search up to 400px wide, not 480px      | On every desktop screen                                    |

The editor has no Help link of its own yet; with either Top bar option, Help opened
before going there stays open.

**Conditions**: what a site would need set up, faked to judge an option at its
busiest. **Busy top bar** (on by default) shows sample Online, Members and MRR
numbers in the Admin 7 top bar. The real top bar only shows Online with web
analytics set up, and MRR with paid members on.

## Where the changes are

- `layout/side-panel/side-panel.tsx`: the floating layouts
- `layout/admin-layout.tsx`: picks the layout, and where the panel shows
- `layout/admin-frame-top-bar.tsx`, `layout/app-sidebar/settings-sidebar.tsx`:
  the extra Help links

## Adding an option

Add a panel to `HELP_PANELS` or an access point to `HELP_ACCESS_POINTS` in
`concepts.ts`. A new way of placing the panel is a new `HelpPanelLayout`,
handled in `side-panel.tsx`; a new access point is a new flag on `HelpAccess`,
read where its Help link is drawn.
