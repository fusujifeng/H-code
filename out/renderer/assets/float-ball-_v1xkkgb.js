const ball = document.getElementById("ball");
const menu = document.getElementById("menu");
ball.addEventListener("dblclick", () => {
  window.electronAPI?.showMainWindow();
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
