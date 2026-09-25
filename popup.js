document.addEventListener("DOMContentLoaded", () => {
  const saveButton = document.getElementById("saveButton");
  const deleteAllButton = document.getElementById("deleteAllButton");
  const savedLinksDiv = document.getElementById("savedLinks");
  const deleteConfirmModal = document.getElementById("deleteConfirmModal");
  const confirmDeleteButton = document.getElementById("confirmDelete");
  const cancelDeleteButton = document.getElementById("cancelDelete");
  const thumbnailCheckbox = document.getElementById("thumbnailCheckbox");
  
  // Load thumbnail preference
  chrome.storage.local.get(["useThumbnail"], ({ useThumbnail = true }) => {
    thumbnailCheckbox.checked = useThumbnail;
  });

  // Save thumbnail preference
  thumbnailCheckbox.addEventListener("change", () => {
    chrome.storage.local.set({ useThumbnail: thumbnailCheckbox.checked });
  });

  deleteConfirmModal.addEventListener("click", (event) => {
    const modalContent = deleteConfirmModal.querySelector(".modal-content");
    if (!modalContent.contains(event.target)) {
      closeModal();
    }
  });

  // Event listener for checkbox changes
  document.getElementById('thumbnailCheckbox').addEventListener('change', function() {
    this.title = this.checked 
        ? this.dataset.tooltipOn 
        : this.dataset.tooltipOff;
  });

  // Set initial state based on chrome.storage.local
  const checkbox = document.getElementById('thumbnailCheckbox');
  chrome.storage.local.get(["useThumbnail"], ({ useThumbnail = true }) => {
    checkbox.checked = useThumbnail; // Set checkbox state
    checkbox.title = useThumbnail 
        ? checkbox.dataset.tooltipOn 
        : checkbox.dataset.tooltipOff; // Set initial title
  });

  loadSavedLinks();

  saveButton.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.url) return alert("No active tab found.");
      chrome.storage.local.get(["useThumbnail"], ({ useThumbnail = true }) => {
        chrome.runtime.sendMessage(
          { action: "getVideoData", tabId: tab.id, url: tab.url, useThumbnail },
          (response) => {
            if (chrome.runtime.lastError || !response) return alert("Could not retrieve video data. Ensure a video is playing.");
            if (response.time === null || response.time === undefined) return alert("No video found on this page.");
            const timestamp = formatTime(response.time);
            const linkWithTimestamp = updateTimestampInUrl(tab.url, response.time);
            const siteName = getSiteName(tab.url);
            saveLink(linkWithTimestamp, response.title, timestamp, response.time, siteName, response.thumbnail, loadSavedLinks);
          }
        );
      });
    });
  });

  deleteAllButton.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    deleteAllButton.blur();
    document.body.style.cursor = "default";
    deleteAllButton.style.pointerEvents = "none";
    const modalContent = deleteConfirmModal.querySelector(".modal-content");
    modalContent.querySelector("p").textContent = "Are you sure you want to delete all unlocked links?";
    deleteConfirmModal.dataset.action = "deleteAll";
    deleteConfirmModal.classList.remove("hide");
    deleteConfirmModal.style.display = "flex";
    requestAnimationFrame(() => {
      deleteConfirmModal.classList.add("show");
      confirmDeleteButton.focus();
      setTimeout(() => {
        deleteAllButton.style.pointerEvents = "auto";
      }, 300);
    });
  });

  confirmDeleteButton.addEventListener("click", () => {
    const action = deleteConfirmModal.dataset.action;

    if (action === "updateVideo") {
      const index = deleteConfirmModal.dataset.index;
      updateVideo(index);
      closeModal();
    } else {
      chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
        // Keep only links where locked === true
        const remainingLinks = savedLinks.filter(link => link.locked === true);

        chrome.storage.local.set({ savedLinks: remainingLinks }, () => {
          loadSavedLinks();
          closeModal();
        });
      });
    }
  });

  cancelDeleteButton.addEventListener("click", closeModal);

  const closeButton = document.getElementById("closeButton");
  closeButton.addEventListener("click", () => {
    window.close();
  });
  
  let isModifiedEnterPressed = false;
  let preventertime = new Date(-30610224000000);
  document.addEventListener("keydown", (e) => {
    if (deleteConfirmModal.style.display === "flex") {
      if (e.key === "Enter") {
        confirmDeleteButton.click();
      } else if (e.key === "Escape") {
        cancelDeleteButton.click();
      }
      e.preventDefault();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if ((e.shiftKey || (e.ctrlKey)) && isModifiedEnterPressed) {
        return;
      }
      if (e.shiftKey || (e.ctrlKey)) {
        isModifiedEnterPressed = true;
      }
      if ((e.key === "Enter") && (Date.now() - preventertime)<850) {
        return;
      }
      if (e.key === "Enter"){
        preventertime = Date.now();
      }

      if (!contextMenu.classList.contains("hide")) {
        // duplicateOption.click();
      } else {
        chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
          if (!tab?.url) return alert("No active tab found.");
          chrome.storage.local.get(["useThumbnail", "savedLinks"], ({ useThumbnail = true, savedLinks = [] }) => {
            chrome.runtime.sendMessage(
              { action: "getVideoData", tabId: tab.id, url: tab.url, useThumbnail },
              (response) => {
                if (chrome.runtime.lastError || !response) return alert("Could not retrieve video data. Ensure a video is playing.");
                if (response.time === null || response.time === undefined) return alert("No video found on this page.");
                const timestamp = formatTime(response.time);
                const linkWithTimestamp = updateTimestampInUrl(tab.url, response.time);
                const siteName = getSiteName(tab.url);
                const baseUrl = getBaseUrl(new URL(tab.url));
                if (e.ctrlKey && e.shiftKey) {
                  // Ctrl+Shift+Enter: Update the last video that is not the current video
                  const existingIndex = savedLinks.slice().reverse().findIndex(link => getBaseUrl(new URL(link.link)) !== baseUrl) !== -1 ? savedLinks.length - 1 - savedLinks.slice().reverse().findIndex(link => getBaseUrl(new URL(link.link)) !== baseUrl) : -1;
                  if (existingIndex !== -1) {
                    savedLinks[existingIndex].link = linkWithTimestamp;
                    savedLinks[existingIndex].title = response.title;
                    savedLinks[existingIndex].timestamp = timestamp;
                    savedLinks[existingIndex].timeSeconds = response.time;
                    savedLinks[existingIndex].siteName = siteName;
                    savedLinks[existingIndex].thumbnail = response.thumbnail;
                    chrome.storage.local.set({ savedLinks }, () => {
                      loadSavedLinks();
                      setTimeout(() => {
                        const updatedBtn = document.querySelector(`.update-timestamp-btn[data-index="${existingIndex}"]`);
                        if (updatedBtn) {
                          const group = updatedBtn.querySelector('.slide-up-group');

                          // Remove slide-up class if exists to re-trigger animation
                          group.classList.remove('slide-up');
                          void group.offsetWidth; // force reflow

                          // Add slide-up class to start fade+slide animation (0.5s)
                          group.classList.add('slide-up');

                          // After 700ms, start the SVG animations
                          setTimeout(() => {
                            const paths = updatedBtn.querySelectorAll('path[class^="anim-path"]');
                            paths.forEach(path => {
                              path.querySelectorAll('animate, animateTransform').forEach(anim => {
                                anim.beginElement();
                              });
                            });

                            // Clean up slide-up class for next click
                            group.classList.remove('slide-up');
                          }, 500);
                        }
                      }, 50);
                    });
                  } else {
                    // alert("No other video found to update.");
                  }
                }
                else if (e.shiftKey) {
                  // Shift+Enter: Add as new video regardless of existing
                  saveLink(linkWithTimestamp, response.title, timestamp, response.time, siteName, response.thumbnail, loadSavedLinks);
                } else {
                  // Enter: Update last occurrence if exists, else add new
                  const existingIndex = savedLinks.slice().reverse().findIndex(link => getBaseUrl(new URL(link.link)) === baseUrl) !== -1 ? savedLinks.length - 1 - savedLinks.slice().reverse().findIndex(link => getBaseUrl(new URL(link.link)) === baseUrl) : -1;
                  if (existingIndex !== -1) {
                    savedLinks[existingIndex].link = linkWithTimestamp;
                    savedLinks[existingIndex].title = response.title;
                    savedLinks[existingIndex].timestamp = timestamp;
                    savedLinks[existingIndex].timeSeconds = response.time;
                    savedLinks[existingIndex].siteName = siteName;
                    if (!savedLinks[existingIndex].locked) {
                      savedLinks[existingIndex].thumbnail = response.thumbnail
                    }
                    chrome.storage.local.set({ savedLinks }, () => {
                      loadSavedLinks();
                      setTimeout(() => {
                        const updatedBtn = document.querySelector(`.update-timestamp-btn[data-index="${existingIndex}"]`);
                        if (updatedBtn) {
                          const group = updatedBtn.querySelector('.slide-up-group');

                          // Remove slide-up class if exists to re-trigger animation
                          group.classList.remove('slide-up');
                          void group.offsetWidth; // force reflow

                          // Add slide-up class to start fade+slide animation (0.5s)
                          group.classList.add('slide-up');

                          // After 700ms, start the SVG animations
                          setTimeout(() => {
                            const paths = updatedBtn.querySelectorAll('path[class^="anim-path"]');
                            paths.forEach(path => {
                              path.querySelectorAll('animate, animateTransform').forEach(anim => {
                                anim.beginElement();
                              });
                            });

                            // Clean up slide-up class for next click
                            group.classList.remove('slide-up');
                          }, 500);
                        }
                      }, 50);
                    });
                  } else {
                    saveLink(linkWithTimestamp, response.title, timestamp, response.time, siteName, response.thumbnail, loadSavedLinks);
                  }
                }
              }
            );
          });
        });
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === "Enter") {
      isModifiedEnterPressed = false;
      preventertime = new Date(-30610224000000);
    }
  });

  savedLinksDiv.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest(".delete-btn");
    const editBtn = e.target.closest(".edit-btn");
    const updateTimestampBtn = e.target.closest(".update-timestamp-btn");
    const updateVideoBtn = e.target.closest(".update-video-btn");
    const linkItem = e.target.closest(".link-item-link");
  
    if (deleteBtn) {
      e.stopPropagation();
      deleteLink(deleteBtn.dataset.index,e);
      loadSavedLinks();
    } else if (editBtn) {
      e.stopPropagation();
      const index = editBtn.dataset.index;
      editLinkTitle(index);
    } else if (updateTimestampBtn) {
     e.stopPropagation();
     const index = updateTimestampBtn.dataset.index;
     updateLinkTimestamp(index);
   } else if (updateVideoBtn) {
      e.stopPropagation();
      const index = updateVideoBtn.dataset.index;
      // Show confirmation modal for update video
      const modalContent = deleteConfirmModal.querySelector(".modal-content");
      modalContent.querySelector("p").textContent = "Are you sure you want to update this video's details?";
      deleteConfirmModal.dataset.action = "updateVideo";
      deleteConfirmModal.dataset.index = index;
      deleteConfirmModal.classList.remove("hide");
      deleteConfirmModal.style.display = "flex";
      requestAnimationFrame(() => {
        deleteConfirmModal.classList.add("show");
        confirmDeleteButton.focus();
      });
    } else if (linkItem) {
      e.preventDefault();
      const url = linkItem.href;
      const timestamp = new URL(url).searchParams.get("t")?.replace("s", "");
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        const currentUrl = new URL(tab.url);
        const targetUrl = new URL(url);
        const currentBase = getBaseUrl(currentUrl);
        const targetBase = getBaseUrl(targetUrl);
        if ((currentBase === targetBase && timestamp) && !e.ctrlKey) {
          const seconds = parseFloat(timestamp);
          if (!isNaN(seconds)) {
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              function: seekToTime,
              args: [seconds],
              world: "MAIN",
            }, (results) => {
              if (chrome.runtime.lastError || !results) {
                console.warn("Seek failed:", chrome.runtime.lastError?.message);
                chrome.tabs.update(tab.id, { url });
                window.close();
              }
            });
          } else {
            chrome.tabs.update(tab.id, { url });
            window.close();
          }
        } else {
          if (e.ctrlKey) {
            chrome.tabs.create({ url, active: false });
          } else {
            chrome.tabs.update(tab.id, { url });
            window.close();
          }
        }
      });
    }
  });

  let draggedItem = null;
  let draggedClone = null;
  let placeholder = null;
  let currentIndex = -1;
  let isDragging = false;
  let lastPlaceholderIndex = -1;
  let lastUpdateTime = 0;
  let scrollInterval = null; // For continuous scrolling
  let isLastItem = false; // Cache for last item check
  const debounceDelay = 50;

  savedLinksDiv.addEventListener("mousedown", (e) => {
    const dragHandle = e.target.closest(".drag-handle");
    if (!dragHandle) return;
    e.preventDefault();
    e.stopPropagation();
    const linkItem = dragHandle.closest(".link-item");
    if (!linkItem) return;

    isDragging = true;
    draggedItem = linkItem;
    currentIndex = Array.from(savedLinksDiv.children).indexOf(linkItem);
    document.body.style.cursor = "grabbing";

    // Cache isLastItem at drag start
    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      isLastItem = currentIndex === savedLinks.length - 1;
    });

    const rect = linkItem.getBoundingClientRect();
    const containerRect = savedLinksDiv.getBoundingClientRect();

    draggedClone = linkItem.cloneNode(true);
    draggedClone.classList.add("dragged-clone");
    draggedClone.style.position = "fixed";
    draggedClone.style.width = `${rect.width}px`;
    draggedClone.style.height = `${rect.height}px`;
    draggedClone.style.left = `${draggedItem.getBoundingClientRect() + containerRect.left + savedLinksDiv.scrollLeft}px`;
    draggedClone.style.top = `${Math.max(55, e.clientY - rect.height / 2)}px`;
    draggedClone.style.pointerEvents = "none";
    draggedClone.style.zIndex = "999";

    savedLinksDiv.appendChild(draggedClone);

    placeholder = document.createElement("div");
    placeholder.className = "link-item placeholder";
    linkItem.parentNode.replaceChild(placeholder, linkItem);

    lastPlaceholderIndex = currentIndex;

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function updateClonePosition(e) {
    if (!draggedClone || !draggedItem) return;

    const cloneHeight = draggedClone.offsetHeight;
    const containerRect = savedLinksDiv.getBoundingClientRect();

    let y = e.clientY - (cloneHeight / 2) - 3.4;
    const minY = 54;
    const maxY = window.innerHeight - cloneHeight - 20;
    y = Math.max(minY, Math.min(maxY, y) + 5);

    const x = draggedItem.getBoundingClientRect().left + containerRect.left + savedLinksDiv.scrollLeft;

    draggedClone.style.top = `${y}px`;
    draggedClone.style.left = `${x}px`;
  }

  function updatePlaceholderPosition(e) {
    if (!placeholder || !draggedItem || !(placeholder instanceof Node)) return;
  
    const now = Date.now();
    if (now - lastUpdateTime < debounceDelay) return;
    lastUpdateTime = now;
  
    const items = Array.from(savedLinksDiv.querySelectorAll(".link-item:not(.placeholder)"));
    const mouseY = e.clientY;
    let newPlaceholderIndex = -1;
  
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!(item instanceof Node)) {
        console.warn("Invalid item in items array:", item);
        continue;
      }
      const rect = item.getBoundingClientRect();
      const isPlaceholderBefore = lastPlaceholderIndex < i+1;
      const threshold = isPlaceholderBefore ? rect.top + rect.height / 5 : rect.bottom - rect.height / 5;
  
      if (mouseY < threshold) {
        try {
          savedLinksDiv.insertBefore(placeholder, item);
          newPlaceholderIndex = i;
          break;
        } catch (err) {
          console.error("Error inserting placeholder:", err);
        }
      }
    }
  
    if (newPlaceholderIndex === -1) {
      try {
        savedLinksDiv.appendChild(placeholder);
        newPlaceholderIndex = items.length + 1;
      } catch (err) {
        console.error("Error appending placeholder:", err);
      }
    }
  
    lastPlaceholderIndex = newPlaceholderIndex;
  }
  
  function onMouseMove(e) {
    if (!isDragging || !draggedItem || !draggedClone || !placeholder) return;
  
    lastClientY = e.clientY;
  
    requestAnimationFrame(() => {
      updateClonePosition(e);
      updatePlaceholderPosition(e);
  
      const containerRect = savedLinksDiv.getBoundingClientRect();
      const scrollThreshold = 40;
      const maxScrollSpeed = 5;
      let scrollSpeed = 0;
  
      if (e.clientY < containerRect.top + scrollThreshold) {
        scrollSpeed = -maxScrollSpeed * (1 - (e.clientY - containerRect.top) / scrollThreshold);
      } else if (e.clientY > containerRect.bottom - scrollThreshold && !isLastItem) {
        scrollSpeed = maxScrollSpeed * (1 - (containerRect.bottom - e.clientY) / scrollThreshold);
      }
  
      if (scrollSpeed !== 0) {
        if (!scrollInterval) {
          scrollInterval = setInterval(() => {
            if (!isDragging) {
              clearInterval(scrollInterval);
              scrollInterval = null;
              return;
            }
  
            const currentClientY = lastClientY;
            const currentContainerRect = savedLinksDiv.getBoundingClientRect();
            let currentScrollSpeed = 0;
  
            if (currentClientY < currentContainerRect.top + scrollThreshold) {
              currentScrollSpeed = -maxScrollSpeed * (1 - (currentClientY - currentContainerRect.top) / scrollThreshold);
            } else if (currentClientY > currentContainerRect.bottom - scrollThreshold && !isLastItem) {
              currentScrollSpeed = maxScrollSpeed * (1 - (currentContainerRect.bottom - currentClientY) / scrollThreshold);
            }
  
            if (currentScrollSpeed === 0) {
              clearInterval(scrollInterval);
              scrollInterval = null;
              return;
            }
  
            savedLinksDiv.scrollTop = Math.round(savedLinksDiv.scrollTop + currentScrollSpeed);
            updatePlaceholderPosition({ clientY: currentClientY });
  
            const scrollHeight = savedLinksDiv.scrollHeight;
            const clientHeight = savedLinksDiv.clientHeight;
            if (
              (savedLinksDiv.scrollTop <= 0 && currentScrollSpeed < 0) ||
              (savedLinksDiv.scrollTop >= scrollHeight - clientHeight && currentScrollSpeed > 0)
            ) {
              clearInterval(scrollInterval);
              scrollInterval = null;
            }
          }, 10);
        }
      } else {
        if (scrollInterval) {
          clearInterval(scrollInterval);
          scrollInterval = null;
        }
      }
    });
  }

  function onMouseUp(e) {
  if (!draggedItem || !draggedClone || !placeholder) return;

  if (scrollInterval) {
    clearInterval(scrollInterval);
    scrollInterval = null;
  }
  const newIndex = Array.from(savedLinksDiv.children).indexOf(placeholder);

  chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
    const reversed = savedLinks.slice().reverse();
    const fromIndex = currentIndex;
    const toIndex = newIndex;

    if (fromIndex !== toIndex) {
      const [movedItem] = reversed.splice(fromIndex, 1);
      reversed.splice(toIndex, 0, movedItem);
      const updatedLinks = reversed.reverse();
      chrome.storage.local.set({ savedLinks: updatedLinks }, () => {
        placeholder.parentNode.replaceChild(draggedItem, placeholder);
        draggedClone.remove();
        draggedItem = null;
        draggedClone = null;
        placeholder = null;
        isDragging = false;
        lastPlaceholderIndex = -1;
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
        document.body.style.cursor = "default";
        loadSavedLinks();
      });
    } else {
      placeholder.parentNode.replaceChild(draggedItem, placeholder);
      draggedClone.remove();
      draggedItem = null;
      draggedClone = null;
      placeholder = null;
      isDragging = false;
      lastPlaceholderIndex = -1;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    }
  });
}

  function closeModal() {
    deleteConfirmModal.dataset.action = "Reset"
    deleteConfirmModal.classList.remove("show");
    deleteConfirmModal.classList.add("hide");
    setTimeout(() => {
      deleteConfirmModal.style.display = "none";
    }, 300);
  }
  
  function formatTime(seconds) {
    if (seconds <= 0) return "0m 0s";
  
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
  
    let timeString = "";
    if (days > 0) timeString += `${days}d `;
    if (hours > 0 || days > 0) timeString += `${hours}h `;
    timeString += `${mins}m ${secs}s`;
  
    return timeString.trim();
  }

  function updateTimestampInUrl(url, seconds) {
    const urlObj = new URL(url);
    if (urlObj.pathname.startsWith("/shorts/")) {
      const videoId = urlObj.pathname.split("/shorts/")[1];
      urlObj.pathname = "/watch";
      urlObj.searchParams.set("v", videoId);
    }
    urlObj.searchParams.set("t", `${Math.floor(seconds)}s`);
    return urlObj.toString();
  }

  function getSiteName(url) {
    try {
      const hostname = new URL(url).hostname.replace(/^www\./, "");
      return hostname
        .split(".")[0]
        .replace(/-/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join("");
    } catch {
      return "Unknown";
    }
  }

  function getBaseUrl(urlObj) {
    const clonedUrl = new URL(urlObj);
    clonedUrl.searchParams.delete("t");
    if (clonedUrl.pathname.startsWith("/shorts/")) {
      const videoId = clonedUrl.pathname.split("/shorts/")[1];
      clonedUrl.pathname = "/watch";
      clonedUrl.searchParams.set("v", videoId);
    }
    return clonedUrl.toString();
  }

  function saveLink(link, title, timestamp, timeSeconds, siteName, thumbnail, callback) {
    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      savedLinks.push({ link, title, timestamp, timeSeconds, siteName, thumbnail });
      chrome.storage.local.set({ savedLinks }, () => {
        callback();
        setTimeout(() => {
          savedLinksDiv.scrollTo({ top: 0, behavior: 'smooth' });
          console.log("Scrolled to top after adding new link");
        }, 100);
      });
    });
  }

  function updateLinkTimestamp(index) {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      if (!tab?.url) return alert("No active tab found.");
      chrome.storage.local.get(["useThumbnail"], ({ useThumbnail = true }) => {
        chrome.runtime.sendMessage(
          { action: "getVideoData", tabId: tab.id, url: tab.url, useThumbnail },
          (response) => {
            if (chrome.runtime.lastError || !response) return alert("Could not retrieve video data.");
            if (response.time === null || response.time === undefined) return alert("No video found on this page.");
            const timestamp = formatTime(response.time);
            const linkWithTimestamp = updateTimestampInUrl(tab.url, response.time);
            const siteName = getSiteName(tab.url);
            chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
              const linkIndex = parseInt(index);
              savedLinks[linkIndex].link = linkWithTimestamp;
              savedLinks[linkIndex].title = response.title;
              savedLinks[linkIndex].timestamp = timestamp;
              savedLinks[linkIndex].timeSeconds = response.time;
              savedLinks[linkIndex].siteName = siteName;
              if (!savedLinks[linkIndex].locked) {
                savedLinks[linkIndex].thumbnail = response.thumbnail
              }
              chrome.storage.local.set({ savedLinks }, () => {
              loadSavedLinks();
              // Trigger SVG animation for the updated link item
              setTimeout(() => {
                const updatedBtn = document.querySelector(`.update-timestamp-btn[data-index="${linkIndex}"]`);
                if (updatedBtn) {
                  const group = updatedBtn.querySelector('.slide-up-group');

                  // Remove slide-up class if exists to re-trigger animation
                  group.classList.remove('slide-up');
                  void group.offsetWidth; // force reflow

                  // Add slide-up class to start fade+slide animation (0.5s)
                  group.classList.add('slide-up');

                  // After 700ms, start the SVG animations
                  setTimeout(() => {
                    const paths = updatedBtn.querySelectorAll('path[class^="anim-path"]');
                    paths.forEach(path => {
                      path.querySelectorAll('animate, animateTransform').forEach(anim => {
                        anim.beginElement();
                      });
                    });

                    // Clean up slide-up class for next click
                    group.classList.remove('slide-up');
                  }, 500);
                }
              }, 50);
            });
            });
          }
        );
      });
    });
  }

  function updateVideo(index) {
     chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
       if (!tab?.url) return alert("No active tab found.");
       chrome.storage.local.get(["useThumbnail"], ({ useThumbnail = true }) => {
         chrome.runtime.sendMessage(
           { action: "getVideoData", tabId: tab.id, url: tab.url, useThumbnail },
           (response) => {
             if (chrome.runtime.lastError || !response) return alert("Could not retrieve video data.");
             if (response.time === null || response.time === undefined) return alert("No video found on this page.");
             const timestamp = formatTime(response.time);
             const linkWithTimestamp = updateTimestampInUrl(tab.url, response.time);
             const siteName = getSiteName(tab.url);
             chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
                const linkIndex = parseInt(index);
                savedLinks[linkIndex].link = linkWithTimestamp;
                savedLinks[linkIndex].title = response.title;
                savedLinks[linkIndex].timestamp = timestamp;
                savedLinks[linkIndex].timeSeconds = response.time;
                savedLinks[linkIndex].siteName = siteName;
                savedLinks[linkIndex].thumbnail = response.thumbnail;
                chrome.storage.local.set({ savedLinks }, () => {
                loadSavedLinks();
                // Trigger SVG animation for the updated link item
                setTimeout(() => {
                  const updatedBtn = document.querySelector(`.update-timestamp-btn[data-index="${linkIndex}"]`);
                  if (updatedBtn) {
                    const group = updatedBtn.querySelector('.slide-up-group');

                    // Remove slide-up class if exists to re-trigger animation
                    group.classList.remove('slide-up');
                    void group.offsetWidth; // force reflow

                    // Add slide-up class to start fade+slide animation (0.5s)
                    group.classList.add('slide-up');

                    // After 700ms, start the SVG animations
                    setTimeout(() => {
                      const paths = updatedBtn.querySelectorAll('path[class^="anim-path"]');
                      paths.forEach(path => {
                        path.querySelectorAll('animate, animateTransform').forEach(anim => {
                          anim.beginElement();
                        });
                      });

                      // Clean up slide-up class for next click
                      group.classList.remove('slide-up');
                    }, 500);
                  }
                }, 50);
              });
             });
           }
         );
       });
     });
   }

  function loadSavedLinks() {
    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      const currentBaseUrl = tab?.url ? getBaseUrl(new URL(tab.url)) : "";
      chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
        savedLinksDiv.innerHTML = "";
        savedLinks
          .slice()
          .reverse()
          .forEach((item, index) => {
            const linkItem = document.createElement("div");
            linkItem.className = "link-item";
            linkItem.title = item.title;
            linkItem.dataset.index = savedLinks.length - 1 - index;
            const isSameVideo = currentBaseUrl === getBaseUrl(new URL(item.link));
            linkItem.innerHTML = `
              <div class="drag-handle" title="">
                <span></span>
                <span></span>
              </div>
              <a href="${item.link}" class="link-item-link" title="${item.title}">
                ${item.thumbnail ? `<img src="${item.thumbnail}" alt="Thumbnail">` : ""}
                <div class="link-text">
                  <span class="link-title">${item.title}</span>
                  <div class="timestamp">${item.timestamp} • ${item.siteName}</div>
                </div>
              </a>
            ${!isSameVideo ? `
              <button class="update-video-btn" data-index="${savedLinks.length - 1 - index}" title="Update Video">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="1.5 -0.8 23 22" fill="none" stroke="currentColor" stroke-width="0.65" stroke-linecap="round" stroke-linejoin="round">
                  <g transform="scale(0.023) translate(370, 300)" fill="#eee" stroke="#eee" stroke-width="5">
                    <path d="M325.606,84.668L245.334,4.394c-2.813-2.813-6.628-4.393-10.607-4.393h-39.708
                        C195.013,0.001,195.006,0,195,0H75c-0.006,0-0.013,0.001-0.02,0.001H15c-8.284,0-15,6.716-15,15V315c0,8.284,6.716,15,15,15h60h180
                        h60c8.284,0,15-6.716,15-15V95.274C330,91.296,328.42,87.48,325.606,84.668z M90,30.001h90V110H90V30.001z M90,300v-80h150v80H90z
                        M300,300h-30v-95c0-8.284-6.716-15-15-15H75c-8.284,0-15,6.716-15,15v95H30V30.001h30V125c0,8.284,6.716,15,15,15h120
                        c8.284,0,15-6.716,15-15V30.001h18.514L300,101.487V300z"></path>
                  </g>
                  <path d="M18.19 5.6 Q18.19 7.6 18.19 9.6"></path>
                  <path d="M18 5 16.5 7"></path>
                  <path d="M18 5 19.7 7"></path>
                </svg>
              </button>` : ""}
            ${isSameVideo ? `
              <button class="update-timestamp-btn" data-index="${savedLinks.length - 1 - index}" title="Update Timestamp">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0.6 -0.8 23 22" fill="none" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="11" r="4" stroke-width="1"></circle>
                  <circle cx="12" cy="11" r="0.3" fill="currentColor"></circle> <!-- Inner circle filled -->

                  <polyline points="12 8.3 12 11 13.2 13.1" stroke-width="0.9"></polyline>

                  <g class="slide-up-group">
                    <path class="anim-path1" d="M18 10.13 Q18 5.6 18 5.6" stroke-dasharray="4.2" stroke-dashoffset="0" stroke-width="0.75">
                      <animate attributeName="stroke-dashoffset" values="3;0" dur="0.1s" calcMode="linear" repeatCount="1" fill="freeze" begin="indefinite"/>
                    </path>
                    <path class="anim-path2" d="M17.8 9 16.3 11" stroke-dasharray="2.83" stroke-dashoffset="0" transform="translate(0,-4.6)" stroke-width="0.85">
                      <animate attributeName="stroke-dashoffset" values="2.83;0" dur="0.1s" fill="freeze" begin="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" from="0 0" to="0 -4.6" dur="0.1s" calcMode="linear" repeatCount="1" fill="freeze" begin="indefinite"/>
                    </path>
                    <path class="anim-path3" d="M18 9 19.7 11" stroke-dasharray="2.83" stroke-dashoffset="0" transform="translate(0,-4.6)" stroke-width="0.85">
                      <animate attributeName="stroke-dashoffset" values="2.83;0" dur="0.1s" fill="freeze" begin="indefinite"/>
                      <animateTransform attributeName="transform" type="translate" from="0 0" to="0 -4.6" dur="0.1s" calcMode="linear" repeatCount="1" fill="freeze" begin="indefinite"/>
                    </path>
                  </g>
                </svg>
              </button>`  : ""}
              <button class="edit-btn" data-index="${savedLinks.length - 1 - index}" title="Edit title">
                <svg width="16" height="16" viewBox="-2 0 27 26" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button class="delete-btn" data-index="${savedLinks.length - 1 - index}" title="Delete this link">
                <svg viewBox="1 0 22 26" fill="none" stroke="currentColor" stroke-width="1.7">
                  <path d="M1.9 6h20.5M19 6l-1 14H6L5 6" />
                  <path d="M10 10v7.5" />
                  <path d="M14 10v7.5" />
                </svg>
              </button>
            `;
            savedLinksDiv.appendChild(linkItem);
          });
      });
    });
  }

  function deleteLink(index,event) {
    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      if (!savedLinks[index].locked || (event && event.ctrlKey && event.shiftKey)){
        savedLinks.splice(parseInt(index), 1);
        chrome.storage.local.set({ savedLinks }, loadSavedLinks);
      }
    });
  }

  function editLinkTitle(index) {
    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      const link = savedLinks[parseInt(index)];
      const newTitle = prompt("Edit link title:", link.title);
      if (newTitle !== null && newTitle.trim() !== "") {
        savedLinks[parseInt(index)].title = newTitle.trim();
        chrome.storage.local.set({ savedLinks }, loadSavedLinks);
      }
    });
  }

  function seekToTime(seconds) {
    const video = document.querySelector("video[src]");
    if (video && video.readyState >= 2) {
      video.currentTime = seconds;
      if (video.paused) video.play().catch(() => {});
    } else {
      console.warn("Video element not found or not ready");
    }
  }
  let contextTargetIndex = null;

  const contextMenu = document.getElementById("customContextMenu");
  const duplicateOption = document.getElementById("duplicateOption");
  const lockOption = document.getElementById("lockOption");

  savedLinksDiv.addEventListener("contextmenu", (e) => {
    const linkItemlink = e.target.closest(".link-item-link");
    if (!linkItemlink) return;
    const linkItem = e.target.closest(".link-item");

    e.preventDefault();
    contextTargetIndex = parseInt(linkItem.dataset.index);

    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      lockOption.textContent = savedLinks[contextTargetIndex].locked ? "Unlock this link" : "Lock this link";
      contextMenu.style.top = `${e.clientY}px`;
      contextMenu.style.left = `${e.clientX}px`;
      contextMenu.classList.remove("hide");
    });
  });

  duplicateOption.addEventListener("click", () => {
    if (contextTargetIndex === null) return;
    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      const duplicated = { ...savedLinks[contextTargetIndex], locked: false };
      savedLinks.splice(contextTargetIndex, 0, duplicated);
      chrome.storage.local.set({ savedLinks }, loadSavedLinks);
    });
    contextMenu.classList.add("hide");
  });

  lockOption.addEventListener("click", () => {
    if (contextTargetIndex === null) return;
    chrome.storage.local.get(["savedLinks"], ({ savedLinks = [] }) => {
      const link = savedLinks[contextTargetIndex];
      link.locked = !link.locked;
      console.log(savedLinks[contextTargetIndex].title,link.locked)
      chrome.storage.local.set({ savedLinks }, loadSavedLinks);
      contextMenu.classList.add("hide");
    });
  });

  document.addEventListener("click", () => {
    contextMenu.classList.add("hide");
  });

  document.addEventListener("keydown", (e) => {
    if (!contextMenu.classList.contains("hide")) {
      const menuItems = [duplicateOption, lockOption];
      let currentIndex = menuItems.indexOf(document.activeElement);
      if (e.key === "ArrowDown") {
        e.preventDefault();
        currentIndex = (currentIndex + 1) % menuItems.length;
        menuItems[currentIndex].focus();
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        currentIndex = (currentIndex - 1 + menuItems.length) % menuItems.length;
        menuItems[currentIndex].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (currentIndex !== -1) {
          menuItems[currentIndex].click();
        }
      }
    }
  });

  document.addEventListener("mousedown", (e) => {
    const isContext = e.target.closest("#customContextMenu");
    if (!isContext) {
      contextMenu.classList.add("hide");
    }
  });

});