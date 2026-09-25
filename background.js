chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action !== "getVideoData" || !request.url || !request.tabId) {
    sendResponse({ time: null, title: null, thumbnail: null });
    return true;
  }

  chrome.scripting.executeScript(
    {
      target: { tabId: request.tabId },
      function: getVideoData,
      args: [request.url, request.useThumbnail],
      world: "MAIN",
    },
    (results) => {
      if (chrome.runtime.lastError || !results || !results[0]) {
        console.warn("Script execution failed:", chrome.runtime.lastError?.message || "No results");
        sendResponse({ time: null, title: null, thumbnail: null });
      } else {
        sendResponse(results[0].result);
      }
    }
  );
  return true;
});

function getVideoData(tabUrl, useThumbnail) {
  const url = new URL(tabUrl);
  const isYouTube = url.hostname.includes("youtube.com");
  let videoId = null;
  if (isYouTube) {
    videoId = url.searchParams.get("v") || (url.pathname.startsWith("/shorts/") ? url.pathname.split("/shorts/")[1] : null);
  }

  let attempts = 0;
  const maxAttempts = 10;
  return new Promise((resolve) => {
    function findVideo() {
      const videoEl = document.querySelector("video[src]");
      if (videoEl && videoEl.readyState >= 2) {
        resolve(videoEl);
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(findVideo, 500);
      } else {
        resolve(null);
      }
    }
    findVideo();
  }).then((video) => {
    let title = document.title?.trim() || "Unknown Title";
    let thumbnailImage = null;

    // Only attempt canvas capture if useThumbnail is false and video is not DRM-protected
    if (video && !useThumbnail) {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      // Check if canvas is not blank (i.e., not DRM-protected)
      const isBlank = ctx.getImageData(0, 0, canvas.width, canvas.height).data.every((val, i) => i % 4 === 3 || val === 0);
      if (!isBlank) {
        thumbnailImage = canvas.toDataURL("image/jpeg");
      }
    }

    // Fallback to YouTube thumbnail or metadata only if canvas capture fails or useThumbnail is true
    if (!thumbnailImage) {
      if (isYouTube && videoId && useThumbnail) {
        thumbnailImage = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
      } else {
        const ogImage = document.querySelector('meta[property="og:image"]')?.content;
        const twitterImage = document.querySelector('meta[name="twitter:image"]')?.content;
        const videoPoster = video?.poster;
        thumbnailImage = ogImage || twitterImage || videoPoster || null;
      }
    }

    if (isYouTube && videoId) {
      title = title.replace(" - YouTube", "").trim();
    }

    if (!title || title === "Unknown Title") {
      title = new URL(tabUrl).hostname.replace(/^www\./, "");
    }

    // If thumbnail is a URL, fetch it as a data URL
    if (thumbnailImage && !thumbnailImage.startsWith("data:")) {
      return fetch(thumbnailImage, { mode: "cors" })
        .then((response) => response.blob())
        .then((blob) => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                time: video?.currentTime || null,
                title,
                thumbnail: reader.result,
              });
            };
            reader.readAsDataURL(blob);
          });
        })
        .catch((error) => {
          console.warn("Thumbnail fetch failed:", error.message);
          return {
            time: video?.currentTime || null,
            title,
            thumbnail: null,
          };
        });
    }

    return {
      time: video?.currentTime || null,
      title,
      thumbnail: thumbnailImage,
    };
  });
}