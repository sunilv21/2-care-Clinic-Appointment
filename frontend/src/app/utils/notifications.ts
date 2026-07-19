/**
 * Sidebar notification system.
 * Dispatches a custom event that Sidebar.tsx listens for.
 * Notifications auto-dismiss after 5 seconds.
 */
export function showSidebarNotification(detail: {
  message: string;
  type?: "success" | "error" | "info" | "warning";
}) {
  window.dispatchEvent(
    new CustomEvent("sidebar-notification", {
      detail: { message: detail.message, type: detail.type || "info" },
    })
  );
}
