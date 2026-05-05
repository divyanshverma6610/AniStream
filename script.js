// ============================================
// FIREBASE CONFIGURATION
// Replace with your Firebase project config
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
// ADMIN EMAILS - Add your admin email here
// ============================================
const ADMIN_EMAILS = ["your-admin-email@gmail.com"];

// ============================================
// FIREBASE INITIALIZE
// ============================================
firebase.initializeApp(firebaseConfig);
var auth = firebase.auth();
var db = firebase.firestore();

// ============================================
// GLOBAL STATE
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
var isLoadingVideos = false;

// ============================================
// YOUTUBE URL EXTRACTOR (IMPROVED)
// Supports all Muse Asia URL formats
// ============================================
function extractYouTubeId(url) {
  if (!url) return null;
  url = url.trim();

  // If it's already just an 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  var patterns = [
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/clip\/([a-zA-Z0-9_-]{11})/
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = url.match(patterns[i]);
    if (match && match[1] && match[1].length === 11) {
      return match[1];
    }
  }
  return null;
}

// ============================================
// UTILITIES
// ============================================
function getYouTubeThumbnail(videoId, quality) {
  quality = quality || "hqdefault";
  if (!videoId) {
    return "https://via.placeholder.com/320x180/1a1a25/e50914?text=AniStream";
  }
  return "https://img.youtube.com/vi/" + videoId + "/" + quality + ".jpg";
}

function getEmbedUrl(videoId) {
  if (!videoId) return "";
  return "https://www.youtube.com/embed/" + videoId +
    "?autoplay=1&rel=0&modestbranding=1&showinfo=0";
}

function formatNumber(n) {
  n = parseInt(n) || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return String(n);
}

function sanitizeText(str) {
  if (!str) return "";
  var div = document.createElement("div");
  div.appendChild(document.createTextNode(str));
  return div.innerHTML;
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================
function showToast(message, type, duration) {
  type = type || "info";
  duration = duration || 3500;

  var container = document.getElementById("toast-container");
  if (!container) return;

  var iconMap = {
    success: "fa-check-circle",
    error: "fa-exclamation-circle",
    info: "fa-info-circle",
    warning: "fa-exclamation-triangle"
  };

  var toast = document.createElement("div");
  toast.className = "toast " + type;

  var icon = document.createElement("i");
  icon.className = "fas " + (iconMap[type] || iconMap.info);

  var span = document.createElement("span");
  span.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(span);
  container.appendChild(toast);

  setTimeout(function () {
    toast.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(function () {
      if (toast && toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, duration);
}

// ============================================
// NAVIGATION & PAGE MANAGEMENT
// ============================================
function showPage(pageName) {
  if (pageName !== "player") {
    previousPage = pageName;
  }

  var allPages = document.querySelectorAll(".page");
  for (var i = 0; i < allPages.length; i++) {
    allPages[i].classList.remove("active");
  }

  var allNavLinks = document.querySelectorAll(".nav-link");
  for (var j = 0; j < allNavLinks.length; j++) {
    allNavLinks[j].classList.remove("active");
  }

  var targetPage = document.getElementById("page-" + pageName);
  if (targetPage) {
    targetPage.classList.add("active");
  }

  var targetLink = document.querySelector('[data-page="' + pageName + '"]');
  if (targetLink) {
    targetLink.classList.add("active");
  }

  window.scrollTo({ top: 0, behavior: "smooth" });

  // Load page-specific data
  if (pageName === "watchlist") loadWatchlistPage();
  if (pageName === "continue") loadContinuePage();
  if (pageName === "admin") loadAdminPage();
  if (pageName === "browse") loadBrowsePage();
}

function goBack() {
  showPage(previousPage || "home");
}

function toggleMobileMenu() {
  var menu = document.getElementById("mobile-menu");
  if (menu) menu.classList.toggle("active");
}

function closeMobileMenu() {
  var menu = document.getElementById("mobile-menu");
  if (menu) menu.classList.remove("active");
}

function toggleUserDropdown() {
  var dropdown = document.getElementById("user-dropdown");
  if (dropdown) dropdown.classList.toggle("active");
}

// Close dropdowns when clicking outside
document.addEventListener("click", function (e) {
  if (!e.target.closest(".user-menu")) {
    var dd = document.getElementById("user-dropdown");
    if (dd) dd.classList.remove("active");
  }
  if (!e.target.closest(".search-container")) {
    var sr = document.getElementById("search-results");
    if (sr) sr.classList.remove("active");
  }
  if (!e.target.closest(".mobile-menu") && !e.target.closest(".hamburger")) {
    var mm = document.getElementById("mobile-menu");
    if (mm) mm.classList.remove("active");
  }
});

// Navbar scroll effect
window.addEventListener("scroll", function () {
  var navbar = document.getElementById("navbar");
  if (!navbar) return;
  if (window.scrollY > 80) {
    navbar.classList.add("scrolled");
  } else {
    navbar.classList.remove("scrolled");
  }
});

// ============================================
// FIREBASE AUTHENTICATION
// ============================================
auth.onAuthStateChanged(function (user) {
  currentUser = user;

  if (user) {
    isAdmin = ADMIN_EMAILS.indexOf(user.email) !== -1;

    // Update UI for logged in user
    var signinBtn = document.getElementById("signin-btn");
    var userMenu = document.getElementById("user-menu");
    if (signinBtn) signinBtn.style.display = "none";
    if (userMenu) userMenu.style.display = "block";

    var avatarUrl = user.photoURL ||
      "https://ui-avatars.com/api/?name=" +
      encodeURIComponent(user.displayName || "User") +
      "&background=e50914&color=fff&bold=true";

    var userAvatar = document.getElementById("user-avatar");
    var dropdownAvatar = document.getElementById("dropdown-avatar");
    var userNameDisplay = document.getElementById("user-name-display");
    var userEmailDisplay = document.getElementById("user-email-display");

    if (userAvatar) userAvatar.src = avatarUrl;
    if (dropdownAvatar) dropdownAvatar.src = avatarUrl;
    if (userNameDisplay) userNameDisplay.textContent = user.displayName || "User";
    if (userEmailDisplay) userEmailDisplay.textContent = user.email;

    // Show admin links if admin
    var adminLink = document.getElementById("admin-link");
    var mobileAdminLink = document.getElementById("mobile-admin-link");
    if (isAdmin) {
      if (adminLink) adminLink.style.display = "flex";
      if (mobileAdminLink) mobileAdminLink.style.display = "block";
    } else {
      if (adminLink) adminLink.style.display = "none";
      if (mobileAdminLink) mobileAdminLink.style.display = "none";
    }

    // Load user-specific data
    loadUserData().then(function () {
      var firstName = (user.displayName || "User").split(" ")[0];
      showToast("Welcome back, " + firstName + "! 👋", "success");
    });

  } else {
    isAdmin = false;

    var signinBtn2 = document.getElementById("signin-btn");
    var userMenu2 = document.getElementById("user-menu");
    if (signinBtn2) signinBtn2.style.display = "flex";
    if (userMenu2) userMenu2.style.display = "none";

    var adminLink2 = document.getElementById("admin-link");
    var mobileAdminLink2 = document.getElementById("mobile-admin-link");
    if (adminLink2) adminLink2.style.display = "none";
    if (mobileAdminLink2) mobileAdminLink2.style.display = "none";

    userWatchlist = [];
    userLikes = [];
    userContinueWatching = [];
  }
});

function signInWithGoogle() {
  var provider = new firebase.auth.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  auth.signInWithPopup(provider).catch(function (err) {
    console.error("Sign in error:", err);
    if (err.code === "auth/popup-blocked") {
      showToast("Popup blocked! Please allow popups for this site.", "error", 5000);
    } else if (err.code !== "auth/popup-closed-by-user") {
      showToast("Sign in failed: " + err.message, "error");
    }
  });
}

function signOutUser() {
  auth.signOut().then(function () {
    showToast("Signed out successfully. See you soon! 👋", "info");
    showPage("home");
  }).catch(function (err) {
    showToast("Error signing out: " + err.message, "error");
  });
}

// ============================================
// LOAD USER DATA FROM FIRESTORE
// ============================================
function loadUserData() {
  if (!currentUser) return Promise.resolve();

  return Promise.all([
    db.collection("watchlists").doc(currentUser.uid).get(),
    db.collection("likes").doc(currentUser.uid).get(),
    db.collection("continueWatching").doc(currentUser.uid).get()
  ]).then(function (results) {
    var watchSnap = results[0];
    var likeSnap = results[1];
    var continueSnap = results[2];

    userWatchlist = watchSnap.exists ? (watchSnap.data().videos || []) : [];
    userLikes = likeSnap.exists ? (likeSnap.data().videoIds || []) : [];
    userContinueWatching = continueSnap.exists ? (continueSnap.data().videos || []) : [];

  }).catch(function (err) {
    console.error("Error loading user data:", err);
    userWatchlist = [];
    userLikes = [];
    userContinueWatching = [];
  });
}

// ============================================
// FETCH ALL VIDEOS FROM FIRESTORE
// ============================================
function fetchAllVideos() {
  if (isLoadingVideos) return Promise.resolve(allVideos);
  isLoadingVideos = true;

  return db.collection("videos")
    .orderBy("createdAt", "desc")
    .get()
    .then(function (snapshot) {
      allVideos = snapshot.docs.map(function (doc) {
        var data = doc.data();
        data.id = doc.id;
        return data;
      });
      isLoadingVideos = false;
      return allVideos;
    })
    .catch(function (err) {
      console.error("Error fetching videos:", err);
      isLoadingVideos = false;
      showToast("Error loading videos. Check your connection.", "error");
      return [];
    });
}

// ============================================
// HERO BANNER SETUP
// ============================================
function setupHero(videos) {
  if (!videos || videos.length === 0) return;

  // Prefer featured videos for hero
  heroVideos = videos.filter(function (v) { return v.featured === true; });

  // Fallback to most liked videos
  if (heroVideos.length === 0) {
    heroVideos = videos.slice().sort(function (a, b) {
      return (b.likes || 0) - (a.likes || 0);
    }).slice(0, 5);
  }

  if (heroVideos.length === 0) return;

  heroIndex = 0;
  updateHero(heroVideos[heroIndex]);

  // Auto-rotate hero every 7 seconds
  clearInterval(heroInterval);
  if (heroVideos.length > 1) {
    heroInterval = setInterval(function () {
      heroIndex = (heroIndex + 1) % heroVideos.length;
      updateHero(heroVideos[heroIndex]);
    }, 7000);
  }
}

function updateHero(video) {
  if (!video) return;

  var thumbnail = video.customThumbnail ||
    getYouTubeThumbnail(video.youtubeId, "maxresdefault");

  var heroBg = document.getElementById("hero-bg");
  if (heroBg) {
    heroBg.style.backgroundImage = "url(" + thumbnail + ")";
  }

  var heroTitle = document.getElementById("hero-title");
  if (heroTitle) heroTitle.textContent = video.animeName || "Unknown Anime";

  var heroDesc = document.getElementById("hero-description");
  if (heroDesc) {
    heroDesc.textContent = video.description ||
      "Watch the latest episodes of your favorite anime, now streaming on AniStream.";
  }

  var epText = video.episode > 0 ? "Episode " + video.episode : "Trailer / Movie";
  var heroMeta = document.getElementById("hero-meta");
  if (heroMeta) {
    heroMeta.innerHTML =
      '<span><i class="fas fa-tag"></i> ' + sanitizeText(video.category) + "</span>" +
      '<span><i class="fas fa-heart"></i> ' + formatNumber(video.likes || 0) + " likes</span>" +
      '<span><i class="fas fa-film"></i> ' + epText + "</span>";
  }

  // Wire up hero buttons
  var playBtn = document.getElementById("hero-play-btn");
  if (playBtn) {
    playBtn.onclick = function () { openPlayer(video); };
  }

  var infoBtn = document.getElementById("hero-info-btn");
  if (infoBtn) {
    infoBtn.onclick = function () { openVideoModal(video); };
  }

  var wBtn = document.getElementById("hero-watchlist-btn");
  if (wBtn) {
    var inList = userWatchlist.indexOf(video.id) !== -1;
    wBtn.className = "btn-watchlist-hero" + (inList ? " in-list" : "");
    wBtn.innerHTML = inList
      ? '<i class="fas fa-check"></i> In List'
      : '<i class="fas fa-plus"></i> My List';
    wBtn.onclick = function () { toggleWatchlist(video); };
  }
}

// ============================================
// CREATE ANIME CARD ELEMENT
// ============================================
function createAnimeCard(video) {
  if (!video) return document.createElement("div");

  var thumbnail = video.customThumbnail || getYouTubeThumbnail(video.youtubeId);
  var epLabel = video.episode > 0 ? "Ep " + video.episode : "Trailer";
  var animeName = video.animeName || "Unknown Anime";
  var category = video.category || "Anime";

  // Outer card
  var card = document.createElement("div");
  card.className = "anime-card";

  // Thumbnail wrapper
  var thumbDiv = document.createElement("div");
  thumbDiv.className = "card-thumbnail";

  // Image
  var img = document.createElement("img");
  img.src = thumbnail;
  img.alt = animeName;
  img.loading = "lazy";
  img.onerror = function () {
    this.src = "https://via.placeholder.com/320x180/1a1a25/e50914?text=" +
      encodeURIComponent(animeName.substring(0, 15));
    this.onerror = null;
  };

  // Hover overlay
  var overlay = document.createElement("div");
  overlay.className = "card-overlay";

  // Play button inside overlay
  var playBtn = document.createElement("button");
  playBtn.className = "card-play-btn";
  playBtn.innerHTML = '<i class="fas fa-play"></i>';
  playBtn.title = "Play " + animeName;
  (function (v) {
    playBtn.onclick = function (e) {
      e.stopPropagation();
      openPlayer(v);
    };
  }(video));

  // Badges
  var badges = document.createElement("div");
  badges.className = "card-badges";

  if (video.featured) {
    var featBadge = document.createElement("span");
    featBadge.className = "badge badge-featured";
    featBadge.textContent = "Featured";
    badges.appendChild(featBadge);
  }

  var epBadge = document.createElement("span");
  epBadge.className = "badge badge-ep";
  epBadge.textContent = epLabel;
  badges.appendChild(epBadge);

  overlay.appendChild(playBtn);
  thumbDiv.appendChild(img);
  thumbDiv.appendChild(overlay);
  thumbDiv.appendChild(badges);

  // Card info section
  var infoDiv = document.createElement("div");
  infoDiv.className = "card-info";

  var titleEl = document.createElement("h4");
  titleEl.textContent = animeName;
  titleEl.title = animeName;

  var metaDiv = document.createElement("div");
  metaDiv.className = "card-meta";

  var catSpan = document.createElement("span");
  catSpan.className = "card-category";
  catSpan.textContent = category;

  var likesSpan = document.createElement("span");
  likesSpan.className = "card-likes";
  likesSpan.innerHTML = '<i class="fas fa-heart"></i> ' + formatNumber(video.likes || 0);

  metaDiv.appendChild(catSpan);
  metaDiv.appendChild(likesSpan);
  infoDiv.appendChild(titleEl);
  infoDiv.appendChild(metaDiv);

  card.appendChild(thumbDiv);
  card.appendChild(infoDiv);

  // Open modal on card click
  (function (v) {
    card.addEventListener("click", function () { openVideoModal(v); });
  }(video));

  return card;
}

// ============================================
// RENDER ROW (horizontal scroll)
// ============================================
function renderRow(rowId, videos) {
  var row = document.getElementById(rowId);
  if (!row) return;

  row.innerHTML = "";

  if (!videos || videos.length === 0) {
    var empty = document.createElement("div");
    empty.style.cssText = "color:var(--text-muted);padding:30px 20px;font-size:.9rem;white-space:nowrap;";
    empty.innerHTML = '<i class="fas fa-film" style="margin-right:8px;color:var(--accent);"></i>No videos available yet';
    row.appendChild(empty);
    return;
  }

  videos.forEach(function (v) {
    var card = createAnimeCard(v);
    row.appendChild(card);
  });
}

// ============================================
// RENDER GRID (browse / watchlist / continue)
// ============================================
function renderGrid(gridId, videos) {
  var grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = "";

  if (!videos || videos.length === 0) {
    var wrapper = document.createElement("div");
    wrapper.style.cssText = "grid-column:1/-1;text-align:center;padding:80px 20px;color:var(--text-muted);";
    wrapper.innerHTML =
      '<i class="fas fa-search" style="font-size:3rem;display:block;margin-bottom:16px;color:var(--accent);"></i>' +
      "<h3 style='color:var(--text-primary);margin-bottom:8px;'>No anime found</h3>" +
      "<p>Try a different category or add videos from the Admin Panel</p>";
    grid.appendChild(wrapper);
    return;
  }

  videos.forEach(function (v) {
    var card = createAnimeCard(v);
    grid.appendChild(card);
  });
}

// ============================================
// SCROLL ROW BUTTONS
// ============================================
function scrollRow(btn, direction) {
  var container = btn.closest(".scroll-container");
  if (!container) return;
  var row = container.querySelector(".anime-row");
  if (!row) return;
  row.scrollBy({ left: direction * 650, behavior: "smooth" });
}

// ============================================
// LOAD HOME PAGE SECTIONS
// ============================================
function loadHomePage() {
  return fetchAllVideos().then(function (videos) {

    // Remove skeleton cards
    var skeletons = document.querySelectorAll(".skeleton-card");
    skeletons.forEach(function (s) { s.remove(); });

    if (!videos || videos.length === 0) {
      showToast("No videos yet. Add some from the Admin Panel!", "info", 5000);
      return;
    }

    // Setup rotating hero banner
    setupHero(videos);

    // Trending = top liked videos
    var trending = videos.slice().sort(function (a, b) {
      return (b.likes || 0) - (a.likes || 0);
    }).slice(0, 12);
    renderRow("trending-row", trending);

    // Latest = newest by date (already sorted desc)
    renderRow("latest-row", videos.slice(0, 12));

    // Popular = shuffle top half
    var topHalf = videos.slice(0, Math.ceil(videos.length / 2));
    var popular = topHalf.slice().sort(function () {
      return Math.random() - 0.5;
    }).slice(0, 12);
    renderRow("popular-row", popular);

    // Category rows
    var actionVids = videos.filter(function (v) {
      return v.category === "Action";
    }).slice(0, 10);
    renderRow("action-row", actionVids);

    var romanceVids = videos.filter(function (v) {
      return v.category === "Romance";
    }).slice(0, 10);
    renderRow("romance-row", romanceVids);

    var comedyVids = videos.filter(function (v) {
      return v.category === "Comedy";
    }).slice(0, 10);
    renderRow("comedy-row", comedyVids);
  });
}

// ============================================
// BROWSE PAGE
// ============================================
function loadBrowsePage() {
  var browseGrid = document.getElementById("browse-grid");
  if (browseGrid) {
    browseGrid.innerHTML = '<div class="skeleton-card"></div>'.repeat(8);
  }

  var promise = allVideos.length > 0
    ? Promise.resolve(allVideos)
    : fetchAllVideos();

  promise.then(function () {
    filterByCategory(currentCategory, null);
  });
}

function filterByCategory(cat, btnEl) {
  currentCategory = cat || "All";

  // Update active filter button
  var filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(function (b) { b.classList.remove("active"); });

  if (btnEl) {
    btnEl.classList.add("active");
  } else {
    filterBtns.forEach(function (b) {
      if (b.textContent.trim() === currentCategory) {
        b.classList.add("active");
      }
    });
  }

  var filtered;
  if (currentCategory === "All") {
    filtered = allVideos.slice();
  } else {
    filtered = allVideos.filter(function (v) {
      return v.category === currentCategory;
    });
  }

  renderGrid("browse-grid", filtered);
}

function showBrowseCategory(cat) {
  currentCategory = cat;
  showPage("browse");
  setTimeout(function () {
    filterByCategory(cat, null);
  }, 150);
}

// ============================================
// SEARCH FUNCTIONALITY
// ============================================
var searchInput = document.getElementById("search-input");

if (searchInput) {
  searchInput.addEventListener("input", handleSearch);
  searchInput.addEventListener("focus", handleSearch);
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      searchInput.value = "";
      var sr = document.getElementById("search-results");
      if (sr) sr.classList.remove("active");
    }
  });
}

function handleSearch() {
  var query = searchInput ? searchInput.value.trim().toLowerCase() : "";
  var dropdown = document.getElementById("search-results");
  if (!dropdown) return;

  if (!query) {
    dropdown.classList.remove("active");
    return;
  }

  if (allVideos.length === 0) {
    dropdown.innerHTML = '<div class="search-no-results">Loading videos...</div>';
    dropdown.classList.add("active");
    return;
  }

  var results = allVideos.filter(function (v) {
    var nameMatch = v.animeName && v.animeName.toLowerCase().indexOf(query) !== -1;
    var catMatch = v.category && v.category.toLowerCase().indexOf(query) !== -1;
    var descMatch = v.description && v.description.toLowerCase().indexOf(query) !== -1;
    return nameMatch || catMatch || descMatch;
  }).slice(0, 8);

  dropdown.innerHTML = "";

  if (results.length === 0) {
    var noResult = document.createElement("div");
    noResult.className = "search-no-results";
    noResult.innerHTML = '<i class="fas fa-search" style="margin-right:6px;"></i>No results for "' + sanitizeText(query) + '"';
    dropdown.appendChild(noResult);
  } else {
    results.forEach(function (v) {
      var thumb = v.customThumbnail || getYouTubeThumbnail(v.youtubeId);
      var epText = v.episode > 0 ? "Ep " + v.episode : "Trailer";

      var item = document.createElement("div");
      item.className = "search-result-item";

      var img = document.createElement("img");
      img.src = thumb;
      img.alt = v.animeName;
      img.onerror = function () {
        this.src = "https://via.placeholder.com/50x35/1a1a25/e50914?text=Anime";
        this.onerror = null;
      };

      var infoDiv = document.createElement("div");
      infoDiv.className = "search-result-info";

      var strong = document.createElement("strong");
      strong.textContent = v.animeName;

      var small = document.createElement("span");
      small.textContent = v.category + " · " + epText;

      infoDiv.appendChild(strong);
      infoDiv.appendChild(small);
      item.appendChild(img);
      item.appendChild(infoDiv);

      (function (video) {
        item.onclick = function () {
          if (searchInput) searchInput.value = "";
          dropdown.classList.remove("active");
          openVideoModal(video);
        };
      }(v));

      dropdown.appendChild(item);
    });
  }

  dropdown.classList.add("active");
}

function selectSearchResult(videoId) {
  var video = findVideoById(videoId);
  if (video) {
    if (searchInput) searchInput.value = "";
    var dropdown = document.getElementById("search-results");
    if (dropdown) dropdown.classList.remove("active");
    openVideoModal(video);
  }
}

// ============================================
// HELPER: Find video by ID
// ============================================
function findVideoById(id) {
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].id === id) return allVideos[i];
  }
  return null;
}

// ============================================
// VIDEO PLAYER
// ============================================
function openPlayer(video) {
  if (!video) {
    showToast("Video not found.", "error");
    return;
  }

  if (!video.youtubeId) {
    showToast("Invalid video link. Cannot play.", "error");
    return;
  }

  currentVideoId = video.id;

  // Get all episodes of this anime, sorted by episode number
  currentAnimeVideos = allVideos.filter(function (v) {
    return v.animeName === video.animeName;
  }).sort(function (a, b) {
    return (a.episode || 0) - (b.episode || 0);
  });

  // Find current episode index
  currentEpisodeIndex = 0;
  for (var i = 0; i < currentAnimeVideos.length; i++) {
    if (currentAnimeVideos[i].id === video.id) {
      currentEpisodeIndex = i;
      break;
    }
  }

  // Save to watch history
  saveToWatchHistory(video);

  // Render player UI
  renderPlayer(video);

  // Navigate to player page
  showPage("player");

  // Close modal if open
  closeVideoModal();
}

function renderPlayer(video) {
  if (!video) return;

  var playerIframe = document.getElementById("youtube-player");
  var unavailableDiv = document.getElementById("video-unavailable");

  if (!video.youtubeId) {
    if (playerIframe) playerIframe.style.display = "none";
    if (unavailableDiv) unavailableDiv.style.display = "flex";
    return;
  }

  if (playerIframe) {
    playerIframe.style.display = "block";
    playerIframe.src = getEmbedUrl(video.youtubeId);
  }
  if (unavailableDiv) unavailableDiv.style.display = "none";

  // Update text info
  var animeNameEl = document.getElementById("player-anime-name");
  var epInfoEl = document.getElementById("player-episode-info");
  var categoryBadge = document.getElementById("player-category-badge");
  var descEl = document.getElementById("player-description");
  var likeCountEl = document.getElementById("like-count");
  var sidebarName = document.getElementById("sidebar-anime-name");

  if (animeNameEl) animeNameEl.textContent = video.animeName || "Unknown Anime";
  if (epInfoEl) epInfoEl.textContent = video.episode > 0 ? "Episode " + video.episode : "Trailer / Movie";
  if (categoryBadge) categoryBadge.textContent = video.category || "Anime";
  if (descEl) descEl.textContent = video.description || "No description available for this episode.";
  if (likeCountEl) likeCountEl.textContent = formatNumber(video.likes || 0);
  if (sidebarName) sidebarName.textContent = video.animeName || "";

  // Update like button state
  var likeBtn = document.getElementById("btn-like");
  if (likeBtn) {
    var isLiked = userLikes.indexOf(video.id) !== -1;
    if (isLiked) {
      likeBtn.classList.add("liked");
    } else {
      likeBtn.classList.remove("liked");
    }
  }

  // Update watchlist button state
  updateWatchlistBtn("btn-watchlist-player", video.id);

  // Update prev/next buttons
  var prevBtn = document.getElementById("btn-prev-ep");
  var nextBtn = document.getElementById("btn-next-ep");
  if (prevBtn) prevBtn.disabled = currentEpisodeIndex <= 0;
  if (nextBtn) nextBtn.disabled = currentEpisodeIndex >= currentAnimeVideos.length - 1;

  // Render episode sidebar
  renderEpisodeList(video);
}

function renderEpisodeList(currentVideo) {
  var list = document.getElementById("episode-list");
  if (!list) return;

  list.innerHTML = "";

  if (!currentAnimeVideos || currentAnimeVideos.length === 0) {
    var msg = document.createElement("p");
    msg.style.cssText = "padding:16px;color:var(--text-muted);font-size:.85rem;text-align:center;";
    msg.textContent = "No episodes found for this anime.";
    list.appendChild(msg);
    return;
  }

  currentAnimeVideos.forEach(function (ep, idx) {
    var isActive = ep.id === currentVideo.id;
    var thumb = ep.customThumbnail || getYouTubeThumbnail(ep.youtubeId);
    var epLabel = ep.episode > 0 ? "Episode " + ep.episode : "Trailer";

    var item = document.createElement("div");
    item.className = "episode-item" + (isActive ? " active" : "");

    var thumbImg = document.createElement("img");
    thumbImg.className = "episode-thumb";
    thumbImg.src = thumb;
    thumbImg.alt = epLabel;
    thumbImg.loading = "lazy";
    thumbImg.onerror = function () {
      this.src = "https://via.placeholder.com/80x45/1a1a25/e50914?text=Ep" + ep.episode;
      this.onerror = null;
    };

    var infoDiv = document.createElement("div");
    infoDiv.className = "episode-item-info";

    var strong = document.createElement("strong");
    strong.textContent = epLabel;

    var span = document.createElement("span");
    span.textContent = ep.animeName || "";

    infoDiv.appendChild(strong);
    infoDiv.appendChild(span);
    item.appendChild(thumbImg);
    item.appendChild(infoDiv);

    // Click to play this episode
    (function (episode, index) {
      item.onclick = function () {
        currentEpisodeIndex = index;
        currentVideoId = episode.id;
        saveToWatchHistory(episode);
        renderPlayer(episode);
        window.scrollTo({ top: 0, behavior: "smooth" });
      };
    }(ep, idx));

    list.appendChild(item);
  });

  // Scroll active episode into view
  var activeItem = list.querySelector(".episode-item.active");
  if (activeItem) {
    setTimeout(function () {
      activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 200);
  }
}

function changeEpisode(direction) {
  var newIndex = currentEpisodeIndex + direction;

  if (newIndex < 0 || newIndex >= currentAnimeVideos.length) {
    showToast(direction > 0 ? "No next episode available" : "This is the first episode", "info");
    return;
  }

  currentEpisodeIndex = newIndex;
  var video = currentAnimeVideos[currentEpisodeIndex];
  currentVideoId = video.id;
  saveToWatchHistory(video);
  renderPlayer(video);
  window.scrollTo({ top: 0, behavior: "smooth" });
  showToast("Playing: Episode " + (video.episode || "Trailer"), "info", 2000);
}

// ============================================
// VIDEO MODAL
// ============================================
function openVideoModal(video) {
  if (!video) return;

  modalVideoId = video.id;

  var thumbnail = video.customThumbnail ||
    getYouTubeThumbnail(video.youtubeId, "hqdefault");

  // Set modal image
  var modalImg = document.getElementById("modal-img");
  if (modalImg) {
    modalImg.src = thumbnail;
    modalImg.alt = video.animeName || "Anime";
    modalImg.onerror = function () {
      this.src = "https://via.placeholder.com/700x394/1a1a25/e50914?text=" +
        encodeURIComponent((video.animeName || "Anime").substring(0, 20));
      this.onerror = null;
    };
  }

  // Set modal text
  var modalTitle = document.getElementById("modal-title");
  var modalEpisode = document.getElementById("modal-episode");
  var modalCategory = document.getElementById("modal-category");
  var modalLikeCount = document.getElementById("modal-like-count");
  var modalDesc = document.getElementById("modal-description");

  if (modalTitle) modalTitle.textContent = video.animeName || "Unknown Anime";
  if (modalEpisode) modalEpisode.textContent = video.episode > 0 ? "Episode " + video.episode : "Trailer / Movie";
  if (modalCategory) modalCategory.textContent = video.category || "Anime";
  if (modalLikeCount) modalLikeCount.textContent = formatNumber(video.likes || 0);
  if (modalDesc) modalDesc.textContent = video.description || "No description available for this anime.";

  // Watchlist button state
  updateWatchlistBtn("modal-watchlist-btn", video.id);

  // Like button state in modal
  var modalLikeBtn = document.getElementById("modal-like-btn");
  if (modalLikeBtn) {
    if (userLikes.indexOf(video.id) !== -1) {
      modalLikeBtn.classList.add("liked");
    } else {
      modalLikeBtn.classList.remove("liked");
    }
  }

  // Show modal
  var modal = document.getElementById("video-modal");
  if (modal) {
    modal.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeVideoModal() {
  var modal = document.getElementById("video-modal");
  if (modal) modal.classList.remove("active");
  document.body.style.overflow = "";
  modalVideoId = null;
}

function closeModal(event) {
  var modal = document.getElementById("video-modal");
  if (event.target === modal) closeVideoModal();
}

function playFromModal() {
  var video = findVideoById(modalVideoId);
  if (video) {
    openPlayer(video);
  } else {
    showToast("Video not found.", "error");
  }
}

function toggleWatchlistFromModal() {
  var video = findVideoById(modalVideoId);
  if (video) toggleWatchlist(video);
}

function toggleLikeModal() {
  if (modalVideoId) toggleLike(modalVideoId);
}

// ============================================
// HELPER: Update Watchlist Button
// ============================================
function updateWatchlistBtn(btnId, videoId) {
  var btn = document.getElementById(btnId);
  if (!btn) return;

  var inList = userWatchlist.indexOf(videoId) !== -1;

  if (btnId === "modal-watchlist-btn") {
    btn.className = "btn-watchlist-modal" + (inList ? " in-list" : "");
  } else if (btnId === "btn-watchlist-player") {
    btn.className = "btn-watchlist-player" + (inList ? " in-list" : "");
  }

  btn.innerHTML = inList
    ? '<i class="fas fa-check"></i> In List'
    : '<i class="fas fa-plus"></i> My List';
}

// ============================================
// WATCHLIST SYSTEM
// ============================================
function toggleWatchlist(video) {
  if (!video) return;

  if (!currentUser) {
    showToast("Please sign in to use your watchlist", "info");
    return;
  }

  var videoId = video.id;
  var inList = userWatchlist.indexOf(videoId) !== -1;

  // Optimistic update
  if (inList) {
    userWatchlist = userWatchlist.filter(function (id) { return id !== videoId; });
  } else {
    userWatchlist.push(videoId);
  }

  // Save to Firestore
  db.collection("watchlists").doc(currentUser.uid).set({
    videos: userWatchlist,
    userId: currentUser.uid,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function () {
    var wasAdded = !inList;
    showToast(
      wasAdded ? '"' + video.animeName + '" added to your list ✅' : 'Removed from your list',
      wasAdded ? "success" : "info"
    );

    // Refresh all watchlist-related buttons
    updateWatchlistBtn("modal-watchlist-btn", videoId);
    updateWatchlistBtn("btn-watchlist-player", videoId);

    // Update hero watchlist button
    var heroVid = heroVideos[heroIndex];
    if (heroVid && heroVid.id === videoId) {
      var hBtn = document.getElementById("hero-watchlist-btn");
      if (hBtn) {
        var nowInList = userWatchlist.indexOf(videoId) !== -1;
        hBtn.className = "btn-watchlist-hero" + (nowInList ? " in-list" : "");
        hBtn.innerHTML = nowInList
          ? '<i class="fas fa-check"></i> In List'
          : '<i class="fas fa-plus"></i> My List';
      }
    }

  }).catch(function (err) {
    console.error("Watchlist error:", err);
    showToast("Error updating watchlist. Please try again.", "error");

    // Revert optimistic update
    if (inList) {
      userWatchlist.push(videoId);
    } else {
      userWatchlist = userWatchlist.filter(function (id) { return id !== videoId; });
    }
  });
}

function toggleWatchlistFromPlayer() {
  var video = findVideoById(currentVideoId);
  if (video) toggleWatchlist(video);
}

// ============================================
// WATCHLIST PAGE
// ============================================
function loadWatchlistPage() {
  var grid = document.getElementById("watchlist-grid");
  var authMsg = document.getElementById("watchlist-auth-msg");
  var emptyMsg = document.getElementById("watchlist-empty");

  if (!currentUser) {
    if (authMsg) authMsg.style.display = "block";
    if (grid) grid.style.display = "none";
    if (emptyMsg) emptyMsg.style.display = "none";
    return;
  }

  if (authMsg) authMsg.style.display = "none";
  if (grid) {
    grid.style.display = "grid";
    grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(8);
  }

  var promise = allVideos.length > 0 ? Promise.resolve(allVideos) : fetchAllVideos();

  promise.then(function () {
    return loadUserData();
  }).then(function () {
    var watchlistVideos = allVideos.filter(function (v) {
      return userWatchlist.indexOf(v.id) !== -1;
    });

    if (watchlistVideos.length === 0) {
      if (grid) grid.style.display = "none";
      if (emptyMsg) emptyMsg.style.display = "block";
    } else {
      if (emptyMsg) emptyMsg.style.display = "none";
      if (grid) grid.style.display = "grid";
      renderGrid("watchlist-grid", watchlistVideos);
    }
  }).catch(function (err) {
    console.error("Error loading watchlist:", err);
    showToast("Error loading watchlist.", "error");
  });
}

// ============================================
// CONTINUE WATCHING
// ============================================
function saveToWatchHistory(video) {
  if (!currentUser || !video) return;

  var entry = {
    videoId: video.id,
    animeName: video.animeName || "",
    episode: video.episode || 0,
    category: video.category || "",
    watchedAt: new Date().toISOString()
  };

  // Remove existing entry for this video (avoid duplicates)
  userContinueWatching = userContinueWatching.filter(function (e) {
    return e.videoId !== video.id;
  });

  // Add to beginning
  userContinueWatching.unshift(entry);

  // Keep max 20 entries
  userContinueWatching = userContinueWatching.slice(0, 20);

  // Save to Firestore
  db.collection("continueWatching").doc(currentUser.uid).set({
    videos: userContinueWatching,
    userId: currentUser.uid,
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
    if (authMsg) authMsg.style.display = "block";
    if (grid) grid.style.display = "none";
    if (emptyMsg) emptyMsg.style.display = "none";
    return;
  }

  if (authMsg) authMsg.style.display = "none";
  if (grid) {
    grid.style.display = "grid";
    grid.innerHTML = '<div class="skeleton-card"></div>'.repeat(6);
  }

  var promise = allVideos.length > 0 ? Promise.resolve(allVideos) : fetchAllVideos();

  promise.then(function () {
    return loadUserData();
  }).then(function () {
    var continueVideos = [];
    userContinueWatching.forEach(function (entry) {
      var video = findVideoById(entry.videoId);
      if (video) continueVideos.push(video);
    });

    if (continueVideos.length === 0) {
      if (grid) grid.style.display = "none";
      if (emptyMsg) emptyMsg.style.display = "block";
    } else {
      if (emptyMsg) emptyMsg.style.display = "none";
      if (grid) grid.style.display = "grid";
      renderGrid("continue-grid", continueVideos);
    }
  }).catch(function (err) {
    console.error("Error loading continue watching:", err);
    showToast("Error loading watch history.", "error");
  });
}

// ============================================
// LIKES SYSTEM
// ============================================
function toggleLike(videoId) {
  if (!videoId) videoId = currentVideoId;

  if (!currentUser) {
    showToast("Please sign in to like videos ❤️", "info");
    return;
  }

  if (!videoId) return;

  var video = findVideoById(videoId);
  if (!video) return;

  var isLiked = userLikes.indexOf(videoId) !== -1;

  // Optimistic update
  if (isLiked) {
    userLikes = userLikes.filter(function (id) { return id !== videoId; });
    video.likes = Math.max(0, (video.likes || 0) - 1);
  } else {
    userLikes.push(videoId);
    video.likes = (video.likes || 0) + 1;
  }

  // Update UI immediately
  var likeCountEl = document.getElementById("like-count");
  if (likeCountEl) likeCountEl.textContent = formatNumber(video.likes);

  var likeBtn = document.getElementById("btn-like");
  if (likeBtn) {
    if (!isLiked) {
      likeBtn.classList.add("liked");
    } else {
      likeBtn.classList.remove("liked");
    }
  }

  var modalLikeCount = document.getElementById("modal-like-count");
  if (modalLikeCount && modalVideoId === videoId) {
    modalLikeCount.textContent = formatNumber(video.likes);
  }

  var modalLikeBtn = document.getElementById("modal-like-btn");
  if (modalLikeBtn && modalVideoId === videoId) {
    if (!isLiked) {
      modalLikeBtn.classList.add("liked");
    } else {
      modalLikeBtn.classList.remove("liked");
    }
  }

  // Save to Firestore
  Promise.all([
    db.collection("likes").doc(currentUser.uid).set({
      videoIds: userLikes,
      userId: currentUser.uid,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }),
    db.collection("videos").doc(videoId).update({
      likes: firebase.firestore.FieldValue.increment(isLiked ? -1 : 1)
    })
  ]).then(function () {
    showToast(
      isLiked ? "Removed like" : "You liked this! ❤️",
      isLiked ? "info" : "success",
      2000
    );
  }).catch(function (err) {
    console.error("Like error:", err);
    showToast("Error updating like. Please try again.", "error");

    // Revert optimistic update
    if (isLiked) {
      userLikes.push(videoId);
      video.likes = (video.likes || 0) + 1;
    } else {
      userLikes = userLikes.filter(function (id) { return id !== videoId; });
      video.likes = Math.max(0, (video.likes || 0) - 1);
    }

    if (likeCountEl) likeCountEl.textContent = formatNumber(video.likes);
  });
}

// ============================================
// ADMIN PANEL
// ============================================
function loadAdminPage() {
  var authMsg = document.getElementById("admin-auth-msg");
  var content = document.getElementById("admin-content");

  if (!currentUser) {
    if (authMsg) {
      authMsg.style.display = "block";
      authMsg.innerHTML =
        '<i class="fas fa-lock"></i>' +
        "<h3>Sign In Required</h3>" +
        "<p>Please sign in with your admin account to access the admin panel.</p>" +
        '<button class="btn-signin" onclick="signInWithGoogle()"><i class="fab fa-google"></i> Sign In</button>';
    }
    if (content) content.style.display = "none";
    return;
  }

  if (!isAdmin) {
    if (authMsg) {
      authMsg.style.display = "block";
      authMsg.innerHTML =
        '<i class="fas fa-ban" style="color:#e17055;"></i>' +
        "<h3>Access Denied</h3>" +
        "<p>Your account <strong>" + sanitizeText(currentUser.email) + "</strong> does not have admin privileges.</p>" +
        "<p style='margin-top:8px;font-size:.8rem;color:var(--text-muted);'>Contact the site owner to get admin access.</p>";
    }
    if (content) content.style.display = "none";
    return;
  }

  if (authMsg) authMsg.style.display = "none";
  if (content) content.style.display = "block";

  loadAdminVideos();
  setupAdminFormListener();
}

function loadAdminVideos() {
  var list = document.getElementById("admin-video-list");
  if (list) {
    list.innerHTML = '<div class="skeleton-card" style="height:65px;width:100%;"></div>'.repeat(4);
  }

  db.collection("videos")
    .orderBy("createdAt", "desc")
    .get()
    .then(function (snapshot) {
      adminVideos = snapshot.docs.map(function (doc) {
        var data = doc.data();
        data.id = doc.id;
        return data;
      });

      var countEl = document.getElementById("video-count");
      if (countEl) countEl.textContent = adminVideos.length;

      renderAdminList(adminVideos);
    })
    .catch(function (err) {
      console.error("Error loading admin videos:", err);
      showToast("Error loading videos list.", "error");
    });
}

function renderAdminList(videos) {
  var list = document.getElementById("admin-video-list");
  if (!list) return;

  list.innerHTML = "";

  if (!videos || videos.length === 0) {
    var empty = document.createElement("div");
    empty.style.cssText = "padding:30px;text-align:center;color:var(--text-muted);font-size:.9rem;";
    empty.innerHTML =
      '<i class="fab fa-youtube" style="font-size:2rem;color:var(--accent);display:block;margin-bottom:12px;"></i>' +
      "<p>No videos yet.</p><p>Add your first Muse Asia video above!</p>";
    list.appendChild(empty);
    return;
  }

  videos.forEach(function (video) {
    var item = document.createElement("div");
    item.className = "admin-video-item";

    // Thumbnail
    var thumb = video.customThumbnail || getYouTubeThumbnail(video.youtubeId);
    var img = document.createElement("img");
    img.src = thumb;
    img.alt = video.animeName || "Video";
    img.loading = "lazy";
    img.onerror = function () {
      this.src = "https://via.placeholder.com/80x45/1a1a25/e50914?text=Anime";
      this.onerror = null;
    };

    // Info
    var infoDiv = document.createElement("div");
    infoDiv.className = "admin-video-info";

    var strong = document.createElement("strong");
    strong.textContent = video.animeName || "Unknown";
    strong.title = video.animeName || "";

    var epText = video.episode > 0 ? "Ep " + video.episode : "Trailer";
    var featLabel = video.featured
      ? '<span class="badge badge-featured" style="font-size:.6rem;padding:1px 6px;">Featured</span>'
      : "";

    var meta = document.createElement("div");
    meta.className = "admin-video-meta";
    meta.innerHTML =
      "<span>" + sanitizeText(video.category || "N/A") + "</span>" +
      "<span>·</span>" +
      "<span>" + epText + "</span>" +
      "<span>·</span>" +
      "<span>❤️ " + (video.likes || 0) + "</span>" +
      (video.youtubeId ? "<span>·</span><span>✅ Valid ID</span>" : "<span>·</span><span>⚠️ No ID</span>") +
      featLabel;

    infoDiv.appendChild(strong);
    infoDiv.appendChild(meta);

    // Action buttons
    var actions = document.createElement("div");
    actions.className = "admin-video-actions";

    // Feature toggle button
    var featBtn = document.createElement("button");
    featBtn.className = "btn-feature" + (video.featured ? " featured" : "");
    featBtn.title = video.featured ? "Remove from Featured" : "Add to Featured Banner";
    featBtn.innerHTML = '<i class="fas fa-star"></i>';
    (function (v) {
      featBtn.onclick = function () { toggleFeature(v.id, !v.featured); };
    }(video));

    // Preview button
    var previewBtn = document.createElement("button");
    previewBtn.className = "btn-feature";
    previewBtn.title = "Preview Video";
    previewBtn.style.background = "rgba(74,144,226,0.15)";
    previewBtn.style.color = "#74b9ff";
    previewBtn.style.borderColor = "rgba(74,144,226,0.3)";
    previewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    (function (v) {
      previewBtn.onclick = function () { openVideoModal(v); };
    }(video));

    // Delete button
    var delBtn = document.createElement("button");
    delBtn.className = "btn-delete";
    delBtn.title = "Delete Video";
    delBtn.innerHTML = '<i class="fas fa-trash"></i>';
    (function (v) {
      delBtn.onclick = function () { deleteVideo(v.id, v.animeName); };
    }(video));

    actions.appendChild(featBtn);
    actions.appendChild(previewBtn);
    actions.appendChild(delBtn);

    item.appendChild(img);
    item.appendChild(infoDiv);
    item.appendChild(actions);
    list.appendChild(item);
  });
}

function filterAdminVideos() {
  var searchEl = document.getElementById("admin-search");
  if (!searchEl) return;
  var query = searchEl.value.trim().toLowerCase();

  var filtered = adminVideos.filter(function (v) {
    var nameMatch = v.animeName && v.animeName.toLowerCase().indexOf(query) !== -1;
    var catMatch = v.category && v.category.toLowerCase().indexOf(query) !== -1;
    return nameMatch || catMatch;
  });

  renderAdminList(filtered);
}

// ============================================
// ADMIN FORM - URL Preview Listener
// ============================================
var adminFormListenerSet = false;

function setupAdminFormListener() {
  if (adminFormListenerSet) return;

  var urlInput = document.getElementById("video-youtube-url");
  if (!urlInput) return;

  urlInput.addEventListener("input", function () {
    var url = this.value.trim();
    var videoId = extractYouTubeId(url);
    var previewBox = document.getElementById("video-preview-box");
    if (!previewBox) return;

    if (videoId) {
      previewBox.className = "video-preview-box has-preview";
      previewBox.innerHTML = "";

      var iframe = document.createElement("iframe");
      iframe.src = "https://www.youtube.com/embed/" + videoId + "?rel=0&modestbranding=1";
      iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture");
      iframe.setAttribute("allowfullscreen", "");
      iframe.setAttribute("frameborder", "0");
      previewBox.appendChild(iframe);

      // Show extracted ID as feedback
      showToast("YouTube ID detected: " + videoId, "success", 2000);

    } else if (url.length > 10) {
      previewBox.className = "video-preview-box";
      previewBox.innerHTML =
        '<i class="fas fa-exclamation-triangle" style="color:#fdcb6e;"></i>' +
        "<span>Invalid YouTube URL</span>";
    } else {
      previewBox.className = "video-preview-box";
      previewBox.innerHTML =
        '<i class="fab fa-youtube"></i>' +
        "<span>Enter a YouTube URL to preview</span>";
    }
  });

  adminFormListenerSet = true;
}

// ============================================
// ADD VIDEO (Admin Only)
// ============================================
function addVideo(event) {
  event.preventDefault();

  if (!currentUser) {
    showToast("You must be signed in.", "error");
    return;
  }

  if (!isAdmin) {
    showToast("Admin access required.", "error");
    return;
  }

  // Get form values
  var urlInput = document.getElementById("video-youtube-url");
  var nameInput = document.getElementById("video-anime-name");
  var episodeInput = document.getElementById("video-episode");
  var categorySelect = document.getElementById("video-category");
  var descTextarea = document.getElementById("video-description");
  var thumbInput = document.getElementById("video-thumbnail");
  var featuredCheck = document.getElementById("video-featured");

  var url = urlInput ? urlInput.value.trim() : "";
  var animeName = nameInput ? nameInput.value.trim() : "";
  var episode = episodeInput ? parseInt(episodeInput.value, 10) : 0;
  var category = categorySelect ? categorySelect.value : "";
  var description = descTextarea ? descTextarea.value.trim() : "";
  var customThumbnail = thumbInput ? thumbInput.value.trim() : "";
  var featured = featuredCheck ? featuredCheck.checked : false;

  // Validation
  if (!url) {
    showToast("Please enter a YouTube URL.", "error");
    if (urlInput) urlInput.focus();
    return;
  }

  var videoId = extractYouTubeId(url);
  if (!videoId) {
    showToast("Could not extract YouTube video ID. Please check the URL.", "error");
    if (urlInput) urlInput.focus();
    return;
  }

  if (!animeName) {
    showToast("Please enter the anime name.", "error");
    if (nameInput) nameInput.focus();
    return;
  }

  if (!category) {
    showToast("Please select a category.", "error");
    if (categorySelect) categorySelect.focus();
    return;
  }

  if (isNaN(episode) || episode < 0) {
    showToast("Please enter a valid episode number (0 for trailers).", "error");
    if (episodeInput) episodeInput.focus();
    return;
  }

  // Check for duplicate YouTube ID
  var duplicate = null;
  for (var i = 0; i < allVideos.length; i++) {
    if (allVideos[i].youtubeId === videoId) {
      duplicate = allVideos[i];
      break;
    }
  }

  if (duplicate) {
    showToast(
      'Duplicate! "' + duplicate.animeName + '" (Ep ' + duplicate.episode + ') already uses this video.',
      "error",
      5000
    );
    return;
  }

  // Disable submit button
  var submitBtn = document.getElementById("submit-btn");
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding Video...';
  }

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
    views: 0,
    createdBy: currentUser.uid,
    createdByEmail: currentUser.email,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  db.collection("videos").add(videoData).then(function (docRef) {

    // Add to local arrays
    var newVideo = {};
    for (var key in videoData) {
      if (videoData.hasOwnProperty(key)) newVideo[key] = videoData[key];
    }
    newVideo.id = docRef.id;
    newVideo.createdAt = { toDate: function () { return new Date(); } };

    allVideos.unshift(newVideo);
    adminVideos.unshift(newVideo);

    // Update video count
    var countEl = document.getElementById("video-count");
    if (countEl) countEl.textContent = adminVideos.length;

    // Re-render admin list
    renderAdminList(adminVideos);

    // Reset form
    var form = document.getElementById("add-video-form");
    if (form) form.reset();

    var previewBox = document.getElementById("video-preview-box");
    if (previewBox) {
      previewBox.className = "video-preview-box";
      previewBox.innerHTML = '<i class="fab fa-youtube"></i><span>Enter a YouTube URL to preview</span>';
    }

    showToast('"' + animeName + '" Episode ' + episode + ' added successfully! 🎉', "success", 4000);

    // Refresh home if visible
    var homePage = document.getElementById("page-home");
    if (homePage && homePage.classList.contains("active")) {
      loadHomePage();
    }

  }).catch(function (err) {
    console.error("Error adding video:", err);

    var errMsg = "Error adding video.";
    if (err.code === "permission-denied") {
      errMsg = "Permission denied. Check Firestore rules.";
    } else if (err.message) {
      errMsg = "Error: " + err.message;
    }
    showToast(errMsg, "error", 5000);

  }).then(function () {
    // Re-enable submit button (runs regardless of success/failure)
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fas fa-upload"></i> Add Video';
    }
  });
}

// ============================================
// DELETE VIDEO (Admin Only)
// ============================================
function deleteVideo(videoId, animeName) {
  if (!isAdmin) {
    showToast("Admin access required.", "error");
    return;
  }

  var confirmMsg = 'Delete "' + (animeName || "this video") + '"?\n\nThis cannot be undone.';
  if (!confirm(confirmMsg)) return;

  db.collection("videos").doc(videoId).delete().then(function () {

    allVideos = allVideos.filter(function (v) { return v.id !== videoId; });
    adminVideos = adminVideos.filter(function (v) { return v.id !== videoId; });

    var countEl = document.getElementById("video-count");
    if (countEl) countEl.textContent = adminVideos.length;

    renderAdminList(adminVideos);
    showToast('"' + (animeName || "Video") + '" deleted successfully.', "success");

    // Refresh home if visible
    var homePage = document.getElementById("page-home");
    if (homePage && homePage.classList.contains("active")) {
      loadHomePage();
    }

  }).catch(function (err) {
    console.error("Delete error:", err);
    showToast("Error deleting video: " + (err.message || "Unknown error"), "error");
  });
}

// ============================================
// TOGGLE FEATURE (Admin Only)
// ============================================
function toggleFeature(videoId, shouldFeature) {
  if (!isAdmin) return;

  db.collection("videos").doc(videoId).update({
    featured: shouldFeature
  }).then(function () {

    // Update local arrays
    for (var i = 0; i < allVideos.length; i++) {
      if (allVideos[i].id === videoId) {
        allVideos[i].featured = shouldFeature;
        break;
      }
    }
    for (var j = 0; j < adminVideos.length; j++) {
      if (adminVideos[j].id === videoId) {
        adminVideos[j].featured = shouldFeature;
        break;
      }
    }

    renderAdminList(adminVideos);
    showToast(
      shouldFeature ? "⭐ Video added to featured banner!" : "Removed from featured banner",
      "success"
    );

    // Refresh hero if home is visible
    var homePage = document.getElementById("page-home");
    if (homePage && homePage.classList.contains("active")) {
      setupHero(allVideos);
    }

  }).catch(function (err) {
    console.error("Feature toggle error:", err);
    showToast("Error updating featured status.", "error");
  });
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
document.addEventListener("keydown", function (e) {
  var tag = e.target.tagName.toLowerCase();
  var isTyping = tag === "input" || tag === "textarea" || tag === "select";

  // ESC - close modal / menu
  if (e.key === "Escape") {
    closeVideoModal();
    closeMobileMenu();
  }

  // Arrow keys - change episode in player
  if (!isTyping) {
    var playerPage = document.getElementById("page-player");
    if (playerPage && playerPage.classList.contains("active")) {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        changeEpisode(1);
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        changeEpisode(-1);
      }
    }

    // "/" - focus search
    if (e.key === "/") {
      e.preventDefault();
      var si = document.getElementById("search-input");
      if (si) si.focus();
    }

    // "H" - go home
    if (e.key === "h" || e.key === "H") {
      showPage("home");
    }
  }
});

// ============================================
// APP INITIALIZATION
// ============================================
function initApp() {
  // Hide loading screen after 2.2 seconds
  setTimeout(function () {
    var loadingScreen = document.getElementById("loading-screen");
    if (loadingScreen) {
      loadingScreen.classList.add("hidden");
    }
  }, 2200);

  // Load home page videos
  loadHomePage().catch(function (err) {
    console.error("Error initializing app:", err);
    showToast("Error loading app. Please refresh.", "error");
  });
}

// Start the app
initApp();
