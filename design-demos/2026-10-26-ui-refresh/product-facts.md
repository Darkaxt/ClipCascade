# Verified Starting Point

- Source main at 409347516aeb5b6ff057b657aced747feb214bea after the 3.2.0.33
  release. Android uses React Native; Windows uses Python/Tkinter/ttk and pystray.
- Desktop UI entry points inspected: gui/activity.py, gui/login.py, gui/tray.py.
- Mobile entry points inspected: App.js, SettingsPage.js, ClipboardActivityLog.js.
- Existing actions include local-only text replay, explicit text resend, clear
  history, authentication, settings and service controls. Image/file replay is
  not implied by a disabled text-only action.
- Sent is not Delivered. Delivered requires all actual target sessions to ACK
  successful clipboard application. Available file downloads are not Applied.
- Existing data does not supply a per-peer historical application timeline.
  Proposals must not imply one. Android Shizuku state is separate from transport.
- References are local user-owned applications; local source/assets are the
  authoritative evidence, not web descriptions of similarly named products.
