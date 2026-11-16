type PopupNotificationType = "success" | "error" | "info" | "warning";

interface PopupNotificationAction {
  label: string;
  variant?: "primary" | "secondary";
  closeOnClick?: boolean;
  onClick?: (close: () => void) => void | Promise<void>;
}

interface PopupNotificationOptions {
  duration?: number;
  actions?: PopupNotificationAction[];
}

// Simple notification popup utility for right-side notifications
export function showPopupNotification(
  message: string,
  type: PopupNotificationType = "info",
  options: PopupNotificationOptions = {}
) {
  const areaId = "popup-notification-area";
  let area = document.getElementById(areaId);
  if (!area) {
    area = document.createElement("div");
    area.id = areaId;
    area.className = "popup-notification-area";
    document.body.appendChild(area);
  }

  const colors: Record<PopupNotificationType, string> = {
    success: "linear-gradient(90deg, #22d3ee 0%, #10b981 100%)",
    error: "linear-gradient(90deg, #ef4444 0%, #f43f5e 100%)",
    info: "linear-gradient(90deg, #22d3ee 0%, #a855f7 100%)",
    warning: "linear-gradient(90deg, #fbbf24 0%, #f59e0b 100%)",
  };

  const notification = document.createElement("div");
  notification.className = "notification-popup";
  notification.style.background = colors[type];

  const messageEl = document.createElement("div");
  messageEl.className = "notification-message";
  messageEl.textContent = message;
  notification.appendChild(messageEl);

  const autoCloseDelay =
    typeof options.duration === "number"
      ? options.duration
      : options.actions && options.actions.length > 0
      ? 10000
      : 3500;

  let autoCloseTimer: number | undefined;
  let isClosing = false;

  const closeNotification = () => {
    if (isClosing) return;
    isClosing = true;
    if (autoCloseTimer) window.clearTimeout(autoCloseTimer);
    notification.classList.add("slide-out");
    window.setTimeout(() => notification.remove(), 200);
  };

  if (options.actions && options.actions.length > 0) {
    const actionsEl = document.createElement("div");
    actionsEl.className = "notification-actions";

    options.actions.forEach((action) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `notification-action-btn ${
        action.variant === "primary" ? "primary" : "secondary"
      }`;
      button.textContent = action.label;

      button.addEventListener("click", async () => {
        if (button.disabled) return;

        const maybeClose = () => closeNotification();

        if (action.onClick) {
          try {
            button.disabled = true;
            button.classList.add("loading");
            const result = action.onClick(maybeClose);
            if (
              result &&
              typeof (result as Promise<void>).then === "function"
            ) {
              await result;
            }
          } catch (error) {
            console.error("Notification action failed:", error);
          } finally {
            button.disabled = false;
            button.classList.remove("loading");
          }
        }

        if (action.closeOnClick !== false) {
          maybeClose();
        }
      });

      actionsEl.appendChild(button);
    });

    notification.appendChild(actionsEl);
  }

  area.appendChild(notification);

  if (autoCloseDelay > 0) {
    autoCloseTimer = window.setTimeout(() => {
      closeNotification();
    }, autoCloseDelay);
  }

  notification.addEventListener("mouseenter", () => {
    if (autoCloseTimer) {
      window.clearTimeout(autoCloseTimer);
      autoCloseTimer = undefined;
    }
  });

  notification.addEventListener("mouseleave", () => {
    if (!isClosing && autoCloseDelay > 0 && !autoCloseTimer) {
      autoCloseTimer = window.setTimeout(() => {
        closeNotification();
      }, autoCloseDelay);
    }
  });
}
