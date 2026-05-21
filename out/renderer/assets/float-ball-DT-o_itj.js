console.log("[FloatBallWindow] script loaded, electronAPI:", typeof window.electronAPI);
const ball = document.getElementById("ball");
document.getElementById("menu");
let dragging = false;
let dragStart = { x: 0, y: 0 };
let winStart = { x: 0, y: 0 };
let hasDragged = false;
ball.addEventListener("mousedown", async (e) => {
  if (e.button !== 0) return;
  dragging = true;
  hasDragged = false;
  dragStart = { x: e.screenX, y: e.screenY };
  const pos = await window.electronAPI?.floatBallMoveStart();
  if (pos) winStart = { x: pos[0], y: pos[1] };
});
document.addEventListener("mousemove", (e) => {
  if (!dragging) return;
  const dx = e.screenX - dragStart.x;
  const dy = e.screenY - dragStart.y;
  if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasDragged = true;
  window.electronAPI?.floatBallMove(winStart.x + dx, winStart.y + dy);
});
document.addEventListener("mouseup", () => {
  dragging = false;
});
ball.addEventListener("dblclick", () => {
  window.electronAPI?.showMainWindow();
});
ball.addEventListener("click", () => {
  if (!hasDragged) {
    window.electronAPI?.showMainWindow();
  }
});
ball.addEventListener("contextmenu", (e) => {
  e.preventDefault();
  window.electronAPI?.showFloatBallContextMenu?.();
});
let statusTimer = null;
let thinkingTimer = null;
let wasRunning = false;
function setBallStatus(status) {
  console.log("[FloatBall] setBallStatus:", status);
  ball.classList.remove("status-running", "status-success", "status-error", "status-confirm");
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  if (status !== "none") {
    ball.classList.add(`status-${status}`);
  }
  if (status === "success" || status === "error" || status === "confirm") {
    statusTimer = setTimeout(() => {
      ball.classList.remove(`status-${status}`);
    }, 2400);
  }
}
window.electronAPI?.onPtyData(() => {
  if (!ball.classList.contains("status-running")) {
    setBallStatus("running");
  }
  if (thinkingTimer) clearTimeout(thinkingTimer);
  thinkingTimer = setTimeout(() => {
    if (ball.classList.contains("status-running")) {
      ball.classList.remove("status-running");
    }
  }, 2e3);
});
window.electronAPI?.onPtyExit((_sessionId, code) => {
  console.log("[FloatBall] onPtyExit:", _sessionId, code);
  if (code === 0 || code === null) {
    setBallStatus("success");
  } else {
    setBallStatus("error");
  }
  window.electronAPI?.showMainWindow();
});
window.electronAPI?.onClaudeTaskStart(() => {
  console.log("[FloatBall] onClaudeTaskStart");
  setBallStatus("running");
});
window.electronAPI?.onClaudeClose((code) => {
  console.log("[FloatBall] onClaudeClose:", code);
  if (code === 0) {
    setBallStatus("success");
  } else {
    setBallStatus("error");
  }
  window.electronAPI?.showMainWindow();
});
window.electronAPI?.onQueueStatus((status) => {
  console.log("[FloatBall] onQueueStatus:", status);
  if (status.active > 0) {
    wasRunning = true;
    setBallStatus("running");
  } else if (wasRunning && status.active === 0) {
    wasRunning = false;
    setBallStatus("success");
    window.electronAPI?.showMainWindow();
  }
});
window.electronAPI?.onClaudeConfirmNeeded(() => {
  console.log("[FloatBall] onClaudeConfirmNeeded");
  setBallStatus("confirm");
});
window.electronAPI?.onTaskFinished(() => {
  console.log("[FloatBall] onTaskFinished");
  setBallStatus("success");
  window.electronAPI?.showMainWindow();
});
ball.addEventListener("click", () => {
  if (!hasDragged) {
    setBallStatus("none");
  }
});
ball.addEventListener("dblclick", () => {
  setBallStatus("none");
});
