const ball = document.getElementById("ball");
const menu = document.getElementById("menu");
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
  const rect = ball.getBoundingClientRect();
  menu.style.display = "block";
  menu.style.left = rect.left + "px";
  menu.style.top = rect.bottom + 4 + "px";
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#menu")) {
    menu.style.display = "none";
  }
});
menu.addEventListener("click", (e) => {
  const target = e.target;
  const action = target.dataset.action;
  if (action === "show") {
    window.electronAPI?.showMainWindow();
  } else if (action === "quit") {
    window.electronAPI?.quitApp();
  }
  menu.style.display = "none";
});
let statusTimer = null;
function setBallStatus(status) {
  ball.classList.remove("status-running", "status-success", "status-error");
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  if (status !== "none") {
    ball.classList.add(`status-${status}`);
  }
  if (status === "success" || status === "error") {
    statusTimer = setTimeout(() => {
      ball.classList.remove(`status-${status}`);
    }, 3e3);
  }
}
window.electronAPI?.onClaudeTaskStart(() => {
  setBallStatus("running");
});
window.electronAPI?.onClaudeClose((code) => {
  if (code === 0) {
    setBallStatus("success");
  } else {
    setBallStatus("error");
  }
});
ball.addEventListener("click", () => {
  if (!hasDragged) {
    setBallStatus("none");
  }
});
ball.addEventListener("dblclick", () => {
  setBallStatus("none");
});
