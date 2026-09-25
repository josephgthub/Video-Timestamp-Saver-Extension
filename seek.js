(function () {
  function seekToTimestamp() {
    const url = new URL(window.location.href);
    if (url.hostname.includes("youtube.com")) {
      return;
    }
    const timestamp = url.searchParams.get("t");
    if (!timestamp) return;

    const seconds = parseFloat(timestamp.replace("s", ""));
    if (isNaN(seconds)) return;

    let attempts = 0;
    const maxAttempts = 10;
    const interval = setInterval(() => {
      const video = document.querySelector("video[src]");
      if (video && video.readyState >= 2) {
        video.currentTime = seconds;
        if (video.paused) {
          video.play().catch((e) => {
          });
        }
        clearInterval(interval);
      } else if (attempts >= maxAttempts) {
        clearInterval(interval);
      }
      attempts++;
    }, 500);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") {
    seekToTimestamp();
  } else {
    document.addEventListener("DOMContentLoaded", seekToTimestamp);
  }
})();