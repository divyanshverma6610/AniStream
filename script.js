// ============================================
// FIREBASE CONFIG - Replace with yours
// ============================================
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// ============================================
// ADMIN EMAILS
// ============================================
const ADMIN_EMAILS = ["admin@yourdomain.com"];

// ============================================
// FIREBASE INIT
// ============================================
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

// ============================================
// APP STATE
// ============================================
var currentUser = null;
var isAdmin = false;
var allVideos = [];
var currentVideoId = null;
var currentAnimeVideos = [];
var currentEpisodeIndex = 0;
var currentCategory = "All";
var userWatchlist = [];
var userLikes = [];
var userContinueWatching = [];
var modalVideoId = null;
var previousPage = "home";
var heroVideos = [];
var heroIndex = 0;
var heroInterval = null;
var adminVideos = [];

// ============================================
// UTILITIES
// ============================================
function extractYouTubeId(url) {
  if (!url) return null;
  var patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/watch\?.*v=([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];
  for (var i = 0; i < patterns.length; i++) {
    var match = url.match(patterns[i]);
    if (match) return match[1];
  }
  return null;
}

function getYouTubeThumbnail(videoId, quality) {
  quality = quality || "hqdefault";
  if (!videoId) return "https://via.placeholder.com/320x180/1a1a25/666666?text=No+Thumbnail";
  return "https://img.youtube.com/vi/" + videoId + "/" + quality + ".jpg";
}

function getEmbedUrl(videoId) {
  return "https://www.youtube.com/embed/" + videoId + "?autoplay=1&rel=0&modestbranding=1";
}

function formatNumber(n) {
  n = n || 0;
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function showToast(message, type, duration) {
  type = type || "info";
  duration = duration || 3500;
  var container = document.getElementById("toast-container");
  var icons = { success: "fa-check-circle", error: "fa-exclamation-circle", info: "fa-info-circle" };
  var iconClass = icons[type] || icons.info;
  var toast = document.createElement("div");
  toast.className = "toast " + type;
  toast.innerHTML = '<i class="fas ' + iconClass + '"></i><span>' + message + "</span>";
  container.appendChild(toast);
  setTimeout(function () {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(function () {
      if (toast.parentNode) toast.remove();
    }, 300);
  }, duration);
}

// ============================================
// NAVIGATION
// ============================================
function showPage(pageName) {
  if (pageName !== "player") previousPage = pageName;

  var pages = document.querySelectorAll(".page");
  for (var i = 0; i < pages.length; i++) {
    pages[i].classList.remove("active");
  }

  var links = document.querySelectorAll(".nav-link");
  for (var j = 0; j < links.length; j++) {
    links[j].classList.remove("active");
  }

  var page = document.getElementById("page-" + pageName);
  if (page) page.classList.add("active");

  var navLink = document.querySelector('[data-page="' + pageName + '"]');
  if (navLink) navLink.classList.add("active");

  window.scrollTo({ top: 0, behavior: "smooth" });

  if (pageName === "watchlist") loadWatchlistPage();
  if (pageName === "continue") loadContinuePage();
  if (pageName === "admin") loadAdminPage();
  if (pageName === "browse") loadBrowsePage();
}

function goBack() {
  showPage(previousPage || "home");
}

function toggleMobileMenu() {
  document.getElementById("mobile-menu").classList.toggle("active");
}

function closeMobileMenu() {
  document.getElementById("mobile-menu").classList.remove("active");
}

function toggleUserDropdown() {
  document.getElementById("user-dropdown").classList.toggle("active");
}

document.addEventListener("click", function (e) {
  if (!e.target.closest(".user-menu")) {
    var dd = document.getElementById("user-dropdown");
    if (dd) dd.classList.remove("active");
  }
  if (!e.target.closest(".search-container")) {
    var sr = document.getElementById("search-results");
    if (sr) sr.classList.remove("active");
  }
});

window.addEventListener("scroll", function () {
  var navbar = document.getElementById("navbar");
  if (window.scrollY > 50) navbar.classList.add("scrolled");
  else navbar.classList.remove("scrolled");
});

// ============================================
// FIREBASE AUTH
// ============================================
auth.onAuthStateChanged(function (user) {
  currentUser = user;
  if (user) {
    isAdmin = ADMIN_EMAILS.indexOf(user.email) !== -1;

    document.getElementById("signin-btn").style.display = "none";
    document.getElementById("user-menu").style.display = "block";

    var avatarUrl = user.photoURL || "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.displayName || "User") + "&background=e50914&color=fff";
    document.getElementById("user-avatar").src = avatarUrl;
    document.getElementById("dropdown-avatar").src = avatarUrl;
    document.getElementById("user-name-display").textContent = user.displayName || "User";
    document.getElementById("user-email-display").textContent = user.email;

    if (isAdmin) {
      document.getElementById("admin-link").style.display = "flex";
      document.getElementById("mobile-admin-link").style.display = "block";
    }

    loadUserData().then(function () {
      var firstName = (user.displayName || "User").split(" ")[0];
      showToast("Welcome back, " + firstName + "!", "success");
    });
  } else {
    isAdmin = false;
    document.getElementById("signin-btn").style.display = "flex";
    document.getElementById("user-menu").style.display = "none";
    document.getElementById("admin-link").style.display = "none";
    document.getElementById("mobile-admin-link").style.display = "none";
    userWatchlist = [];
    userLikes = [];
    userContinueWatching = [];
  }
});

function signInWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).catch(function (err) {
    if (err.code !== "auth/popup-closed-by-user") {
      showToast("Sign in failed. Please try again.", "error");
    }
  });
}

function signOutUser() {
  auth.signOut().then(function () {
    showToast("Signed out successfully", "info");
    showPage("home");
  });
}

// ============================================
// LOAD USER DATA
// ============================================
function loadUserData() {
  if (!currentUser) return Promise.resolve();
  return Promise.all([
    db.collection("watchlists").doc(currentUser.uid).get(),
    db.collection("likes").doc(currentUser.uid).get(),
    db.collection("continueWatching").doc(currentUser.uid).get()
  ]).then(function (results) {
    var wSnap = results[0];
    var lSnap = results[1];
    var cSnap = results[2];
    userWatchlist = wSnap.exists ? (wSnap.data().videos || []) : [];
    userLikes = lSnap.exists ? (lSnap.data().videoIds || []) : [];
    userContinueWatching = cSnap.exists ? (cSnap.data().videos || []) : [];
  }).catch(function (err) {
    console.error("Error loading user data:", err);
  });
}

// ============================================
// FETCH VIDEOS
// ============================================
function fetchAllVideos() {
  return db.collection("videos").orderBy("createdAt", "desc").get().then(function (snap) {
    allVideos = snap.docs.map(function (doc) {
      return Object.assign({ id: doc.id }, doc.data());
    });
    return allVideos;
  }).catch(function (err) {
    console.error("Error fetching videos:", err);
    return [];
  });
}

// ============================================
// HERO BANNER
// ============================================
function setupHero(videos) {
  heroVideos = videos.filter(function (v) { return v.featured; });
  if (heroVideos.length === 0) heroVideos = videos.slice(0, 5);
  if (heroVideos.length === 0) return;

  heroIndex = 0;
  updateHero(heroVideos[heroIndex]);

  clearInterval(heroInterval);
  if (heroVideos.length > 1) {
    heroInterval = setInterval(function () {
      heroIndex = (heroIndex + 1) % heroVideos.length;
      updateHero(heroVideos[heroIndex]);
    }, 6000);
  }
}

function updateHero(video) {
  if (!video) return;
  var thumbnail = video.customThumbnail || getYouTubeThumbnail(video.youtubeId, "maxresdefault");
  document.getElementById("hero-bg").style.backgroundImage = "url(" + thumbnail + ")";
  document.getElementById("hero-title").textContent = video.animeName;
  document.getElementById("hero-description").textContent = video.description || "Watch the latest episodes of your favorite anime, now streaming on AniStream.";

  var epText = video.episode > 0 ? "Episode " + video.episode : "Trailer";
  document.getElementById("hero-meta").innerHTML =
    '<span><i class="fas fa-tag"></i> ' + video.category + "</span>" +
    '<span><i class="fas fa-heart"></i> ' + formatNumber(video.likes || 0) + " likes</span>" +
    '<span><i class="fas fa-film"></i> ' + epText + "</span>";

  document.getElementById("hero-play-btn").onclick = function () { openPlayer(video); };
  document.getElementById("hero-info-btn").onclick = function () { openVideoModal(video); };

  var inList = userWatchlist.indexOf(video.id) !== -1;
  var wBtn = document.getElementById("hero-watchlist-btn");
  wBtn.className = "btn-watchlist-hero" + (inList ? " in-list" : "");
  wBtn.innerHTML = inList
    ? '<i class="fas fa-check"></i> In List'
    : '<i class="fas fa-plus"></i> My List';
  wBtn.onclick = function () { toggleWatchlist(video); };
}

// ============================================
// CREATE ANIME CARD
// ============================================
function createAnimeCard(video) {
  var thumbnail = video.customThumbnail || getYouTubeThumbnail(video.youtubeId);
  var epLabel = video.episode > 0 ? "Ep " + video.episode : "Trailer";
  var featuredBadge = video.featured ? '<span class="badge badge-featured">Featured</span>' : "";

  var card = document.createElement("div");
  card.className = "anime-card";

  var thumbDiv = document.createElement("div");
  thumbDiv.className = "card-thumbnail";

  var img = document.createElement("img");
  img.src = thumbnail;
  img.alt = video.animeName;
  img.loading = "lazy";
  img.onerror = function () {
    this.src = "https://via.placeholder.com/320x180/1a1a25/666666?text=" + encodeURIComponent(video.animeName);
  };

  var overlay = document.createElement("div");
  overlay.className = "card-overlay";

  var playBtn = document.createElement("button");
  playBtn.className = "card-play-btn";
  playBtn.innerHTML = '<i class="fas fa-play"></i>';
  playBtn.onclick = function (e) {
    e.stopPropagation();
    openPlayer(video);
  };

  var badges = document.createElement("div");
  badges.className = "card-badges";
  badges.innerHTML = featuredBadge + '<span class="badge badge-ep">' + epLabel + "</span>";

  overlay.appendChild(playBtn);
  thumbDiv.appendChild(img);
  thumbDiv.appendChild(overlay);
  thumbDiv.appendChild(badges);

  var info = document.createElement("div");
  info.className = "card-info";

  var title = document.createElement("h4");
  title.textContent = video.animeName;

  var meta = document.createElement("div");
  meta.className = "card-meta";
  meta.innerHTML =
    '<span class="card-category">' + video.category + "</span>" +
    '<span class="card-likes"><i class="fas fa-heart"></i> ' + formatNumber(video.likes || 0) + "</span>";

  info.appendChild(title);
  info.appendChild(meta);

  card.appendChild(thumbDiv);
  card.appendChild(info);

  card.addEventListener("click", function () { openVideoModal(video); });
  return card;
}

// ============================================
// RENDER ROWS & GRIDS
// ============================================
function renderRow(rowId, videos) {
  var row = document.getElementById(rowId);
  if (!row) return;
  row.innerHTML = "";
  if (!videos || videos.length === 0) {
    row.innerHTML = '<div style="color:var(--text-muted);padding:20px;font-size:.9rem;">No videos available</div>';
    return;
  }
  videos.forEach(function (v) { row.appendChild(createAnimeCard(v)); });
}

function renderGrid(gridId, videos) {
  var grid = document.getElementById(gridId);
  if (!grid) return;
  grid.innerHTML = "";
  if (!videos || videos.length === 0) {
    var empty = document.createElement("div");
    empty.style.cssText = "grid-column:1/-1;text-align:center;padding:60px 20px;color:var(--text-muted);";
    empty.innerHTML = '<i class="fas fa-search" style="font-size:2rem;display:block;margin-bottom:12px;"></i><p>No anime found in this category</p>';
    grid.appendChild(empty);
    return;
  }
  videos.forEach(function (v) {
    var card = createAnimeCard(v);
    grid.appendChild(card);
  });
}

function scrollRow(btn, direction) {
  var row = btn.closest(".scroll-container").querySelector(".anime-row");
  row.scrollBy({ left: direction * 600, behavior: "smooth" });
}

// ============================================
// LOAD HOME PAGE
// ============================================
function loadHomePage() {
  return fetchAllVideos().then(function (videos) {
    if (videos.length === 0) {
      document.querySelectorAll(".skeleton-card").forEach(function (s) { s.remove(); });
      return;
    }

    setupHero(videos);

    var trending = videos.slice().sort(function (a, b) {
      return (b.likes || 0) - (a.likes || 0);
    }).slice(0, 10);
    renderRow("trending-row", trending);
    renderRow("latest-row", videos.slice(0, 10));

    var popular = videos.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 10);
    renderRow("popular-row", popular);

    renderRow("action-row", videos.filter(function (v) { return v.category === "Action"; }).slice(0, 8));
    renderRow("romance-row", videos.filter(function (v) { return v.category === "Romance"; }).slice(0, 8));
    renderRow("comedy-row", videos.filter(function (v) { return v.category === "Comedy"; }).slice(0, 8));
  });
}

// ============================================
// BROWSE PAGE
// ============================================
function loadBrowsePage() {
  var p = allVideos.length === 0 ? fetchAllVideos() : Promise.resolve(allVideos);
  p.then(function () { filterByCategory(currentCategory, null); });
}

function filterByCategory(cat, btnEl) {
  currentCategory = cat;

  document.querySelectorAll(".filter-btn").forEach(function (b) { b.classList.remove("active"); });
  if (btnEl) {
    btnEl.classList.add("active");
  } else {
    document.querySelectorAll(".filter-btn").forEach(function (b) {
      if (b.textContent.trim() === cat) b.classList.add("active");
    });
  }

  var filtered = cat === "All"
    ? allVideos.slice()
    : allVideos.filter(function (v) { return v.category === cat; });

  renderGrid("browse-grid", filtered);
}

function showBrowseCategory(cat) {
  showPage("browse");
  setTimeout(function () { filterByCategory(cat, null); }, 100);
}

// ============================================
// SEARCH
// ============================================
var searchInput = document.getElementById("search-input");
searchInput.addEventListener("input", handleSearch);
searchInput.addEventListener("focus", handleSearch);

function handleSearch() {
  var query = searchInput.value.trim().toLowerCase();
  var dropdown = document.getElementById("search-results");

  if (!query) {
    dropdown.classList.remove("active");
    return;
  }

  var results = allVideos.filter(function (v) {
    return v.animeName.toLowerCase().indexOf(query) !== -1 ||
      v.category.toLowerCase().indexOf(query) !== -1 ||
      (v.description && v.description.toLowerCase().indexOf(query) !== -1);
  }).slice(0, 8);

  if (results.length === 0) {
    dropdown.innerHTML = '<div class="search-no-results"><i class="fas fa-search"></i> No results found</div>';
  } else {
    var html = "";
    results.forEach(function (v) {
      var thumb = v.customThumbnail || getYouTubeThumbnail(v.youtubeId);
      var epText = v.episode > 0 ? "Ep " + v.episode : "Trailer";
      html +=
        '<div class="search-result-item" onclick="selectSearchResult(\'' + v.id + '\')">' +
        '<img src="' + thumb + '" alt="' + v.animeName + '" onerror="this.src=\'https://via.placeholder.com/50x35/1a1a25/666666\'" />' +
        '<div class="search-result-info"><strong>' + v.animeName + "</strong>" +
        "<span>" + v.category + " · " + epText + "</span></div></div>";
    });
    dropdown.innerHTML = html;
  }

  dropdown.classList.add("active");
}

function selectSearchResult(videoId) {
  var video = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].id === videoId) { video = allVideos[i]; break; }
  }
  if (video) {
    document.getElementById("search-results").classList.remove("active");
    searchInput.value = "";
    openVideoModal(video);
  }
}

// ============================================
// VIDEO PLAYER
// ============================================
function openPlayer(video) {
  if (!video || !video.youtubeId) {
    showToast("Invalid video. Cannot play.", "error");
    return;
  }

  currentVideoId = video.id;
  currentAnimeVideos = allVideos.filter(function (v) {
    return v.animeName === video.animeName;
  }).sort(function (a, b) { return a.episode - b.episode; });

  currentEpisodeIndex = 0;
  for (var i = 0; i < currentAnimeVideos.length; i++) {
    if (currentAnimeVideos[i].id === video.id) { currentEpisodeIndex = i; break; }
  }

  saveToWatchHistory(video);
  renderPlayer(video);
  showPage("player");
  closeVideoModal();
}

function renderPlayer(video) {
  var player = document.getElementById("youtube-player");
  var unavailable = document.getElementById("video-unavailable");

  if (!video.youtubeId) {
    player.style.display = "none";
    unavailable.style.display = "flex";
    return;
  }

  player.style.display = "block";
  unavailable.style.display = "none";
  player.src = getEmbedUrl(video.youtubeId);

  document.getElementById("player-anime-name").textContent = video.animeName;
  document.getElementById("player-episode-info").textContent = video.episode > 0 ? "Episode " + video.episode : "Trailer";
  document.getElementById("player-category-badge").textContent = video.category;
  document.getElementById("player-description").textContent = video.description || "No description available.";
  document.getElementById("like-count").textContent = formatNumber(video.likes || 0);
  document.getElementById("sidebar-anime-name").textContent = video.animeName;

  var likeBtn = document.getElementById("btn-like");
  if (userLikes.indexOf(video.id) !== -1) {
    likeBtn.classList.add("liked");
  } else {
    likeBtn.classList.remove("liked");
  }

  var inList = userWatchlist.indexOf(video.id) !== -1;
  var wBtn = document.getElementById("btn-watchlist-player");
  wBtn.className = "btn-watchlist-player" + (inList ? " in-list" : "");
  wBtn.innerHTML = inList
    ? '<i class="fas fa-check"></i> In List'
    : '<i class="fas fa-plus"></i> My List';

  var prevBtn = document.getElementById("btn-prev-ep");
  var nextBtn = document.getElementById("btn-next-ep");
  prevBtn.disabled = currentEpisodeIndex <= 0;
  nextBtn.disabled = currentEpisodeIndex >= currentAnimeVideos.length - 1;

  renderEpisodeList(video);
}

function renderEpisodeList(currentVideo) {
  var list = document.getElementById("episode-list");
  list.innerHTML = "";

  if (currentAnimeVideos.length === 0) {
    list.innerHTML = '<p style="padding:16px;color:var(--text-muted);font-size:.85rem;">No episodes found</p>';
    return;
  }

  currentAnimeVideos.forEach(function (ep, idx) {
    var item = document.createElement("div");
    item.className = "episode-item" + (ep.id === currentVideo.id ? " active" : "");

    var thumb = ep.customThumbnail || getYouTubeThumbnail(ep.youtubeId);
    var epLabel = ep.episode > 0 ? "Episode " + ep.episode : "Trailer";

    var thumbImg = document.createElement("img");
    thumbImg.className = "episode-thumb";
    thumbImg.src = thumb;
    thumbImg.alt = epLabel;
    thumbImg.loading = "lazy";
    thumbImg.onerror = function () {
      this.src = "https://via.placeholder.com/80x45/1a1a25/666666";
    };

    var info = document.createElement("div");
    info.className = "episode-item-info";
    info.innerHTML = "<strong>" + epLabel + "</strong><span>" + ep.animeName + "</span>";

    item.appendChild(thumbImg);
    item.appendChild(info);

    (function (episode, index) {
      item.onclick = function () {
        currentEpisodeIndex = index;
        renderPlayer(episode);
        saveToWatchHistory(episode);
      };
    }(ep, idx));

    list.appendChild(item);
  });

  var activeItem = list.querySelector(".episode-item.active");
  if (activeItem) {
    setTimeout(function () { activeItem.scrollIntoView({ block: "nearest" }); }, 100);
  }
}

function changeEpisode(direction) {
  var newIndex = currentEpisodeIndex + direction;
  if (newIndex < 0 || newIndex >= currentAnimeVideos.length) return;
  currentEpisodeIndex = newIndex;
  var video = currentAnimeVideos[currentEpisodeIndex];
  renderPlayer(video);
  saveToWatchHistory(video);
}

// ============================================
// VIDEO MODAL
// ============================================
function openVideoModal(video) {
  modalVideoId = video.id;
  var thumbnail = video.customThumbnail || getYouTubeThumbnail(video.youtubeId, "hqdefault");

  var modalImg = document.getElementById("modal-img");
  modalImg.src = thumbnail;
  modalImg.onerror = function () {
    this.src = "https://via.placeholder.com/700x394/1a1a25/666666?text=" + encodeURIComponent(video.animeName);
  };

  document.getElementById("modal-title").textContent = video.animeName;
  document.getElementById("modal-episode").textContent = video.episode > 0 ? "Episode " + video.episode : "Trailer";
  document.getElementById("modal-category").textContent = video.category;
  document.getElementById("modal-like-count").textContent = formatNumber(video.likes || 0);
  document.getElementById("modal-description").textContent = video.description || "No description available for this anime.";

  var inList = userWatchlist.indexOf(video.id) !== -1;
  var wBtn = document.getElementById("modal-watchlist-btn");
  wBtn.className = "btn-watchlist-modal" + (inList ? " in-list" : "");
  wBtn.innerHTML = inList
    ? '<i class="fas fa-check"></i> In List'
    : '<i class="fas fa-plus"></i> My List';

  var lBtn = document.getElementById("modal-like-btn");
  if (userLikes.indexOf(video.id) !== -1) {
    lBtn.classList.add("liked");
  } else {
    lBtn.classList.remove("liked");
  }

  document.getElementById("video-modal").classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeVideoModal() {
  document.getElementById("video-modal").classList.remove("active");
  document.body.style.overflow = "";
  modalVideoId = null;
}

function closeModal(event) {
  if (event.target === document.getElementById("video-modal")) closeVideoModal();
}

function playFromModal() {
  var video = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].id === modalVideoId) { video = allVideos[i]; break; }
  }
  if (video) openPlayer(video);
}

function toggleWatchlistFromModal() {
  var video = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].id === modalVideoId) { video = allVideos[i]; break; }
  }
  if (video) toggleWatchlist(video);
}

function toggleLikeModal() {
  toggleLike(modalVideoId);
}

// ============================================
// WATCHLIST
// ============================================
function toggleWatchlist(video) {
  if (!currentUser) {
    showToast("Please sign in to use your watchlist", "info");
    return;
  }

  var videoId = video.id;
  var inList = userWatchlist.indexOf(videoId) !== -1;

  if (inList) {
    userWatchlist = userWatchlist.filter(function (id) { return id !== videoId; });
  } else {
    userWatchlist.push(videoId);
  }

  db.collection("watchlists").doc(currentUser.uid).set({
    videos: userWatchlist,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function () {
    var nowInList = !inList;
    showToast(inList ? "Removed from watchlist" : "Added to watchlist", inList ? "info" : "success");

    // Update modal button
    var wBtn = document.getElementById("modal-watchlist-btn");
    if (wBtn && modalVideoId === videoId) {
      wBtn.className = "btn-watchlist-modal" + (nowInList ? " in-list" : "");
      wBtn.innerHTML = nowInList
        ? '<i class="fas fa-check"></i> In List'
        : '<i class="fas fa-plus"></i> My List';
    }

    // Update player button
    var pBtn = document.getElementById("btn-watchlist-player");
    if (pBtn && currentVideoId === videoId) {
      pBtn.className = "btn-watchlist-player" + (nowInList ? " in-list" : "");
      pBtn.innerHTML = nowInList
        ? '<i class="fas fa-check"></i> In List'
        : '<i class="fas fa-plus"></i> My List';
    }

    // Update hero button
    var hBtn = document.getElementById("hero-watchlist-btn");
    var heroVid = heroVideos[heroIndex];
    if (hBtn && heroVid && heroVid.id === videoId) {
      hBtn.className = "btn-watchlist-hero" + (nowInList ? " in-list" : "");
      hBtn.innerHTML = nowInList
        ? '<i class="fas fa-check"></i> In List'
        : '<i class="fas fa-plus"></i> My List';
    }
  }).catch(function () {
    showToast("Error updating watchlist", "error");
    if (inList) {
      userWatchlist.push(videoId);
    } else {
      userWatchlist = userWatchlist.filter(function (id) { return id !== videoId; });
    }
  });
}

function toggleWatchlistFromPlayer() {
  var video = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].id === currentVideoId) { video = allVideos[i]; break; }
  }
  if (video) toggleWatchlist(video);
}

function loadWatchlistPage() {
  var grid = document.getElementById("watchlist-grid");
  var authMsg = document.getElementById("watchlist-auth-msg");
  var emptyMsg = document.getElementById("watchlist-empty");

  if (!currentUser) {
    authMsg.style.display = "block";
    grid.style.display = "none";
    emptyMsg.style.display = "none";
    return;
  }

  authMsg.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(6);

  var p = allVideos.length === 0 ? fetchAllVideos() : Promise.resolve(allVideos);
  p.then(function () {
    return loadUserData();
  }).then(function () {
    var watchlistVideos = allVideos.filter(function (v) {
      return userWatchlist.indexOf(v.id) !== -1;
    });

    if (watchlistVideos.length === 0) {
      grid.style.display = "none";
      emptyMsg.style.display = "block";
    } else {
      emptyMsg.style.display = "none";
      renderGrid("watchlist-grid", watchlistVideos);
    }
  });
}

// ============================================
// CONTINUE WATCHING
// ============================================
function saveToWatchHistory(video) {
  if (!currentUser) return;

  var newEntry = {
    videoId: video.id,
    animeName: video.animeName,
    episode: video.episode,
    watchedAt: new Date().toISOString()
  };

  userContinueWatching = userContinueWatching.filter(function (e) {
    return e.videoId !== video.id;
  });
  userContinueWatching.unshift(newEntry);
  userContinueWatching = userContinueWatching.slice(0, 20);

  db.collection("continueWatching").doc(currentUser.uid).set({
    videos: userContinueWatching,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(function (err) {
    console.error("Error saving watch history:", err);
  });
}

function loadContinuePage() {
  var grid = document.getElementById("continue-grid");
  var authMsg = document.getElementById("continue-auth-msg");
  var emptyMsg = document.getElementById("continue-empty");

  if (!currentUser) {
    authMsg.style.display = "block";
    grid.style.display = "none";
    emptyMsg.style.display = "none";
    return;
  }

  authMsg.style.display = "none";
  grid.style.display = "grid";
  grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(6);

  var p = allVideos.length === 0 ? fetchAllVideos() : Promise.resolve(allVideos);
  p.then(function () {
    return loadUserData();
  }).then(function () {
    var continueVideos = [];
    userContinueWatching.forEach(function (entry) {
      var found = null;
      for (var i = 0; i < allVideos.length; i++) {
        if (allVideos[i].id === entry.videoId) { found = allVideos[i]; break; }
      }
      if (found) continueVideos.push(found);
    });

    if (continueVideos.length === 0) {
      grid.style.display = "none";
      emptyMsg.style.display = "block";
    } else {
      emptyMsg.style.display = "none";
      renderGrid("continue-grid", continueVideos);
    }
  });
}

// ============================================
// LIKES
// ============================================
function toggleLike(videoId) {
  if (!videoId) videoId = currentVideoId;
  if (!currentUser) {
    showToast("Please sign in to like videos", "info");
    return;
  }

  var video = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].id === videoId) { video = allVideos[i]; break; }
  }
  if (!video) return;

  var liked = userLikes.indexOf(videoId) !== -1;

  if (liked) {
    userLikes = userLikes.filter(function (id) { return id !== videoId; });
  } else {
    userLikes.push(videoId);
  }

  video.likes = Math.max(0, (video.likes || 0) + (liked ? -1 : 1));

  Promise.all([
    db.collection("likes").doc(currentUser.uid).set({
      videoIds: userLikes,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    db.collection("videos").doc(videoId).update({
      likes: firebase.firestore.FieldValue.increment(liked ? -1 : 1)
    })
  ]).then(function () {
    document.getElementById("like-count").textContent = formatNumber(video.likes);

    var likeBtn = document.getElementById("btn-like");
    if (userLikes.indexOf(videoId) !== -1) {
      likeBtn.classList.add("liked");
    } else {
      likeBtn.classList.remove("liked");
    }

    if (modalVideoId === videoId) {
      document.getElementById("modal-like-count").textContent = formatNumber(video.likes);
    }

    showToast(liked ? "Removed like" : "Liked! ❤️", liked ? "info" : "success");
  }).catch(function () {
    showToast("Error updating like", "error");
    if (liked) {
      userLikes.push(videoId);
    } else {
      userLikes = userLikes.filter(function (id) { return id !== videoId; });
    }
    video.likes = Math.max(0, video.likes + (liked ? 1 : -1));
  });
}

// ============================================
// ADMIN PANEL
// ============================================
function loadAdminPage() {
  var authMsg = document.getElementById("admin-auth-msg");
  var content = document.getElementById("admin-content");

  if (!currentUser || !isAdmin) {
    authMsg.style.display = "block";
    content.style.display = "none";
    return;
  }

  authMsg.style.display = "none";
  content.style.display = "block";
  loadAdminVideos();
  setupAdminForm();
}

function loadAdminVideos() {
  var list = document.getElementById("admin-video-list");
  list.innerHTML = '<div class="skeleton-card" style="height:65px;width:100%"></div>'.repeat(5);

  db.collection("videos").orderBy("createdAt", "desc").get().then(function (snap) {
    adminVideos = snap.docs.map(function (doc) {
      return Object.assign({ id: doc.id }, doc.data());
    });
    document.getElementById("video-count").textContent = adminVideos.length;
    renderAdminList(adminVideos);
  }).catch(function () {
    showToast("Error loading videos", "error");
  });
}

function renderAdminList(videos) {
  var list = document.getElementById("admin-video-list");
  list.innerHTML = "";

  if (!videos || videos.length === 0) {
    list.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:.9rem;">No videos yet. Add your first video!</div>';
    return;
  }

  videos.forEach(function (video) {
    var item = document.createElement("div");
    item.className = "admin-video-item";

    var thumb = video.customThumbnail || getYouTubeThumbnail(video.youtubeId);
    var epText = video.episode > 0 ? "Ep " + video.episode : "Trailer";
    var featuredBadge = video.featured ? '<span class="badge badge-featured" style="font-size:.65rem">Featured</span>' : "";

    var img = document.createElement("img");
    img.src = thumb;
    img.alt = video.animeName;
    img.onerror = function () { this.src = "https://via.placeholder.com/80x45/1a1a25/666666"; };

    var infoDiv = document.createElement("div");
    infoDiv.className = "admin-video-info";

    var strong = document.createElement("strong");
    strong.textContent = video.animeName;

    var meta = document.createElement("div");
    meta.className = "admin-video-meta";
    meta.innerHTML =
      "<span>" + video.category + "</span><span>·</span><span>" + epText + "</span>" +
      "<span>·</span><span>" + (video.likes || 0) + " likes</span>" + featuredBadge;

    infoDiv.appendChild(strong);
    infoDiv.appendChild(meta);

    var actions = document.createElement("div");
    actions.className = "admin-video-actions";

    var featBtn = document.createElement("button");
    featBtn.className = "btn-feature" + (video.featured ? " featured" : "");
    featBtn.title = video.featured ? "Unfeature" : "Feature";
    featBtn.innerHTML = '<i class="fas fa-star"></i>';
    (function (vid) {
      featBtn.onclick = function () { toggleFeature(vid.id, !vid.featured); };
    }(video));

    var delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.title = "Delete";
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    (function (vid) {
      delBtn.onclick = function () { deleteVideo(vid.id); };
    }(video));

    actions.appendChild(featBtn);
    actions.appendChild(delBtn);

    item.appendChild(img);
    item.appendChild(infoDiv);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function filterAdminVideos() {
  var query = document.getElementById("admin-search").value.toLowerCase();
  var filtered = adminVideos.filter(function (v) {
    return v.animeName.toLowerCase().indexOf(query) !== -1 ||
      v.category.toLowerCase().indexOf(query) !== -1;
  });
  renderAdminList(filtered);
}

function setupAdminForm() {
  var urlInput = document.getElementById("video-youtube-url");
  urlInput.removeEventListener("input", urlInputHandler);
  urlInput.addEventListener("input", urlInputHandler);
}

function urlInputHandler() {
  var url = document.getElementById("video-youtube-url").value.trim();
  var videoId = extractYouTubeId(url);
  var preview = document.getElementById("video-preview-box");

  if (videoId) {
    preview.className = "video-preview-box has-preview";
    var iframe = document.createElement("iframe");
    iframe.src = "https://www.youtube.com/embed/" + videoId;
    iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
    iframe.setAttribute("allowfullscreen", "");
    iframe.setAttribute("frameborder", "0");
    preview.innerHTML = "";
    preview.appendChild(iframe);
  } else {
    preview.className = "video-preview-box";
    preview.innerHTML = '<i class="fab fa-youtube"></i><span>' + (url ? "Invalid YouTube URL" : "Enter URL to preview") + "</span>";
  }
}

function addVideo(event) {
  event.preventDefault();

  if (!isAdmin) {
    showToast("Admin access required", "error");
    return;
  }

  var url = document.getElementById("video-youtube-url").value.trim();
  var animeName = document.getElementById("video-anime-name").value.trim();
  var episodeVal = document.getElementById("video-episode").value;
  var episode = parseInt(episodeVal, 10);
  var category = document.getElementById("video-category").value;
  var description = document.getElementById("video-description").value.trim();
  var customThumbnail = document.getElementById("video-thumbnail").value.trim();
  var featured = document.getElementById("video-featured").checked;

  var videoId = extractYouTubeId(url);
  if (!videoId) {
    showToast("Invalid YouTube URL. Please enter a valid link.", "error");
    return;
  }

  if (!animeName || !category) {
    showToast("Please fill all required fields", "error");
    return;
  }

  var duplicate = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].youtubeId === videoId) { duplicate = allVideos[i]; break; }
  }
  if (duplicate) {
    showToast("This video already exists: " + duplicate.animeName + " - Ep " + duplicate.episode, "error");
    return;
  }

  var submitBtn = document.getElementById("submit-btn");
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

  var videoData = {
    youtubeId: videoId,
    youtubeUrl: url,
    animeName: animeName,
    episode: isNaN(episode) ? 0 : episode,
    category: category,
    description: description,
    customThumbnail: customThumbnail || "",
    featured: featured,
    likes: 0,
    createdBy: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("videos").add(videoData).then(function (docRef) {
    var newVideo = Object.assign({ id: docRef.id }, videoData);
    newVideo.createdAt = { toDate: function () { return new Date(); } };

    allVideos.unshift(newVideo);
    adminVideos.unshift(newVideo);
    document.getElementById("video-count").textContent = adminVideos.length;
    renderAdminList(adminVideos);

    document.getElementById("add-video-form").reset();
    var preview = document.getElementById("video-preview-box");
    preview.className = "video-preview-box";
    preview.innerHTML = '<i class="fab fa-youtube"></i><span>Enter URL to preview</span>';

    showToast('"' + animeName + '" added successfully! 🎉', "success");

    if (document.getElementById("page-home").classList.contains("active")) {
      loadHomePage();
    }
  }).catch(function (err) {
    console.error("Error adding video:", err);
    showToast("Error adding video. Check console for details.", "error");
  }).finally(function () {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<i class="fas fa-upload"></i> Add Video';
  });
}

function deleteVideo(videoId) {
  if (!isAdmin) return;
  if (!confirm("Are you sure you want to delete this video? This cannot be undone.")) return;

  db.collection("videos").doc(videoId).delete().then(function () {
    allVideos = allVideos.filter(function (v) { return v.id !== videoId; });
    adminVideos = adminVideos.filter(function (v) { return v.id !== videoId; });
    document.getElementById("video-count").textContent = adminVideos.length;
    renderAdminList(adminVideos);
    showToast("Video deleted successfully", "success");

    if (document.getElementById("page-home").classList.contains("active")) {
      loadHomePage();
    }
  }).catch(function () {
    showToast("Error deleting video", "error");
  });
}

function toggleFeature(videoId, shouldFeature) {
  if (!isAdmin) return;

  db.collection("videos").doc(videoId).update({ featured: shouldFeature }).then(function () {
    for (var i = 0; i < allVideos.length; i++) {
      if (allVideos[i].id === videoId) { allVideos[i].featured = shouldFeature; break; }
    }
    for (var j = 0; j < adminVideos.length; j++) {
      if (adminVideos[j].id === videoId) { adminVideos[j].featured = shouldFeature; break; }
    }
    renderAdminList(adminVideos);
    showToast(shouldFeature ? "Video featured on hero banner" : "Video unfeatured", "success");

    if (document.getElementById("page-home").classList.contains("active")) {
      loadHomePage();
    }
  }).catch(function () {
    showToast("Error updating feature status", "error");
  });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") {
    closeVideoModal();
    closeMobileMenu();
  }
  if (e.key === "ArrowRight" && document.getElementById("page-player").classList.contains("active")) {
    changeEpisode(1);
  }
  if (e.key === "ArrowLeft" && document.getElementById("page-player").classList.contains("active")) {
    changeEpisode(-1);
  }
  if (e.key === "/" && !e.target.matches("input, textarea, select")) {
    e.preventDefault();
    searchInput.focus();
  }
});

// ============================================
// INIT
// ============================================
function initApp() {
  setTimeout(function () {
    var ls = document.getElementById("loading-screen");
    if (ls) ls.classList.add("hidden");
  }, 2000);

  loadHomePage();
}

initApp();