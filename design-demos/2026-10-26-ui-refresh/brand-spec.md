# Existing Visual Context

- ClipCascade: retain `logo/window-icon.png` and existing Android artwork. Do not
  change the white tray icon. The cyan network/clipboard artwork is the anchor,
  not an excuse to tint the entire interface cyan.
- TailD reference: inspected `desktop/src/styles.css` and
  `docs/taild/screenshots/overview.png` in the adjacent TailD checkout.
  Background #1f1e1e, surfaces #232222/#2e2d2d, text #f9f7f6/#dad6d5/#afacab,
  green #85d996, warning #e7c971, error #f68f87, blue #85aaf5; Segoe UI;
  64px icon rail; 4px controls; restrained dividers and compact workspaces.
- LLM Coordinator reference: inspected installed Release 0.8.8, manifest release
  39462648073c3d24, and its actual `ui/styles-C5MBG3MB.css`. It shares the TailD
  neutral-charcoal token system, compact icon navigation, 24px headings, 4px
  controls, line-separated rows and semantic status colors. This was source
  inspection, not a claim that its live native window was captured.
- These products are references only, not logos displayed as endorsements in
  ClipCascade. Use their information hierarchy, not their network charts or
  metrics that do not apply to clipboard work.
- Icons: existing installed `lucide-react-native` 1.16.0 ISC-licensed definitions.
  Prototypes extract the library's icon-node data; no hand-drawn replacements.
- Typeface: Segoe UI on Windows and Android-compatible system sans-serif stack.
  No external font/network dependencies or unlicensed commercial fonts.

## Form Follows Use

ClipCascade is a quiet background utility, opened to recover text, resend an item,
or find out why sync failed. Content and truthful state must outweigh decoration.
The most characteristic visual material is the user's clipboard entry, not a
hero illustration. Proposals use harmless example content and the packaged logo.
