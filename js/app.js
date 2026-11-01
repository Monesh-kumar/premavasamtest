/**
 * ══════════════════════════════════════════════════════════
 * PREMA VASAM &bull; 2026 Public Web Client Application (js/app.js)
 * Accessibility &bull; Interactive Meals Planner &bull; Real-time SQLite Forms
 * ══════════════════════════════════════════════════════════
 */

// ── 1. ACCESSIBILITY CONTROLS (FONT SIZING & HIGH CONTRAST) ──
(function initA11y() {
  let currentZoom = parseFloat(localStorage.getItem('pv_zoom') || '16');
  const isHighContrast = localStorage.getItem('pv_contrast') === 'high';

  function applyZoom(px) {
    currentZoom = Math.min(22, Math.max(14, px));
    document.documentElement.style.setProperty('--base-font-size', `${currentZoom}px`);
    localStorage.setItem('pv_zoom', currentZoom);
  }

  function toggleContrast() {
    const isNowHigh = document.body.classList.toggle('high-contrast');
    localStorage.setItem('pv_contrast', isNowHigh ? 'high' : 'normal');
  }

  if (isHighContrast) {
    document.body.classList.add('high-contrast');
  }
  applyZoom(currentZoom);

  window.adjustFontSize = function(delta) {
    applyZoom(currentZoom + delta);
  };

  window.toggleHighContrast = toggleContrast;
})();

// ── 2. TOAST NOTIFICATION HELPER ─────────────────────────────
window.showToast = function(msg, icon = 'check-circle') {
  let toast = document.getElementById('toastNotification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toastNotification';
    toast.className = 'fixed bottom-20 right-6 z-50 bg-stone-900 text-amber-50 px-5 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-amber-500/30 font-medium text-sm';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i data-lucide="${icon}" class="w-5 h-5 text-amber-400"></i> <span>${msg}</span>`;
  if (window.lucide) lucide.createIcons();

  toast.classList.add('show');
  clearTimeout(window._toastTimer);
  window._toastTimer = setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
};

// ── 3. CLIPBOARD COPY HELPER ─────────────────────────────────
window.copyToClipboard = function(text, label = 'Account detail') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied to clipboard!`, 'copy');
  }).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast(`${label} copied!`, 'copy');
  });
};

// ── 3B. MOBILE NAVIGATION DRAWER & AUTO-ADJUST ───────────────
window.toggleMobileMenu = function() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('mobileMenuBtn');
  const icon = document.getElementById('mobileMenuIcon');
  if (!menu) return;
  const isHidden = menu.classList.contains('hidden');
  if (isHidden) {
    menu.classList.remove('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'true');
    if (icon) icon.setAttribute('data-lucide', 'x');
  } else {
    menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (icon) icon.setAttribute('data-lucide', 'menu');
  }
  if (window.lucide) lucide.createIcons();
};

window.closeMobileMenu = function() {
  const menu = document.getElementById('mobileMenu');
  const btn = document.getElementById('mobileMenuBtn');
  const icon = document.getElementById('mobileMenuIcon');
  if (menu && !menu.classList.contains('hidden')) {
    menu.classList.add('hidden');
    if (btn) btn.setAttribute('aria-expanded', 'false');
    if (icon) icon.setAttribute('data-lucide', 'menu');
    if (window.lucide) lucide.createIcons();
  }
};

window.addEventListener('resize', () => {
  if (window.innerWidth >= 1024) {
    window.closeMobileMenu();
  }
});


// ── 4. ABOUT US INTERACTIVE TABS ─────────────────────────────
window.switchAboutTab = function(tabId) {
  document.querySelectorAll('.about-tab-btn').forEach(btn => {
    const isTarget = btn.getAttribute('data-tab') === tabId;
    btn.classList.toggle('active', isTarget);
    btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
  });

  document.querySelectorAll('.tab-pane').forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
};

// ── 5. INTERACTIVE MEALS SPONSORSHIP PLANNER ─────────────────
const MEAL_PRICES = {
  'b_usual': { name: 'Usual Breakfast (Idli, Vada, Sambar, Pongal)', price: 3500 },
  'b_sweet': { name: 'Breakfast with Sweet (Hot Breakfast + Kesari / Payasam)', price: 4000 },
  'l_usual': { name: 'Usual Lunch (Rice, Sambar, Rasam, Poriyal, Curd)', price: 5000 },
  'l_festive': { name: 'Festive Lunch with Vadai & Payasam', price: 6500 },
  'l_nonveg': { name: 'Special Non-Veg Lunch Feast (Chicken / Fish)', price: 9000 },
  'd_usual': { name: 'Usual Dinner (Tiffin / Rice with Sambar & Rasam)', price: 5000 },
  'd_festive': { name: 'Festive Dinner with Vadai & Payasam', price: 6500 },
  'd_nonveg': { name: 'Special Non-Veg Dinner Feast', price: 9000 },
  's_snacks': { name: 'Evening Snacks (Sundal / Bajji + Tea / Milk)', price: 2500 },
  's_icecream': { name: 'Special Ice Cream Treats (200 Cups)', price: 4500 }
};

let selectedMeals = new Set(['l_festive']);

window.toggleMealItem = function(card) {
  const id = card.getAttribute('data-id');
  if (selectedMeals.has(id)) {
    selectedMeals.delete(id);
    card.classList.remove('selected');
  } else {
    selectedMeals.add(id);
    card.classList.add('selected');
  }
  calculateMealsTally();
};

window.applyMealPreset = function(type) {
  selectedMeals.clear();
  document.querySelectorAll('.meal-calc-card').forEach(c => c.classList.remove('selected'));

  if (type === 'lunch') {
    selectedMeals.add('l_festive');
  } else if (type === 'fullday') {
    selectedMeals.add('b_sweet');
    selectedMeals.add('l_festive');
    selectedMeals.add('s_snacks');
    selectedMeals.add('d_festive');
  } else if (type === 'breakfast') {
    selectedMeals.add('b_sweet');
  } else if (type === 'treats') {
    selectedMeals.add('s_snacks');
    selectedMeals.add('s_icecream');
  }

  selectedMeals.forEach(id => {
    const el = document.querySelector(`.meal-calc-card[data-id="${id}"]`);
    if (el) el.classList.add('selected');
  });

  calculateMealsTally();
};

function calculateMealsTally() {
  let total = 0;
  const itemsList = [];

  selectedMeals.forEach(id => {
    if (MEAL_PRICES[id]) {
      total += MEAL_PRICES[id].price;
      itemsList.push(MEAL_PRICES[id].name);
    }
  });

  const totalEl = document.getElementById('calcTotalDisplay');
  const countEl = document.getElementById('calcCountDisplay');
  const formAmountEl = document.getElementById('mealFormAmount');
  const formItemsEl = document.getElementById('mealFormItems');

  if (totalEl) totalEl.innerText = `₹${total.toLocaleString('en-IN')}`;
  if (countEl) countEl.innerText = `${selectedMeals.size} meal option${selectedMeals.size === 1 ? '' : 's'} selected`;
  if (formAmountEl) formAmountEl.value = total;
  if (formItemsEl) formItemsEl.value = itemsList.join(' + ');

  const summaryItemsList = document.getElementById('selectedItemsSummary');
  if (summaryItemsList) {
    if (itemsList.length === 0) {
      summaryItemsList.innerHTML = '<span class="text-stone-400 italic">No meals selected. Click on cards above to add.</span>';
    } else {
      summaryItemsList.innerHTML = itemsList.map(item => `<div class="flex items-center gap-2 text-stone-700 text-sm"><i data-lucide="check" class="w-4 h-4 text-amber-600 shrink-0"></i> <span>${item}</span></div>`).join('');
      if (window.lucide) lucide.createIcons();
    }
  }
}

// ── 6. MEAL RESERVATION FORM SUBMISSION ──────────────────────
window.handleMealBookingSubmit = async function(e) {
  e.preventDefault();
  const form = e.target;
  const btn = document.getElementById('mealSubmitBtn');
  const originalText = btn.innerHTML;

  const total = parseInt(document.getElementById('mealFormAmount').value, 10) || 0;
  if (total <= 0) {
    alert('Please select at least one meal package to sponsor.');
    return;
  }

  const payload = {
    sponsor_name: document.getElementById('mealSponsorName').value.trim(),
    sponsor_phone: document.getElementById('mealSponsorPhone').value.trim(),
    sponsor_email: document.getElementById('mealSponsorEmail').value.trim(),
    sponsor_date: document.getElementById('mealSponsorDate').value,
    occasion: document.getElementById('mealOccasion').value,
    selected_items: document.getElementById('mealFormItems').value || 'Lunch Feast',
    total_amount: total,
    notes: document.getElementById('mealNotes').value.trim()
  };

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Processing Booking...`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/meals/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.ok) {
      document.getElementById('confirmBookingId').innerText = result.id;
      document.getElementById('confirmSponsorName').innerText = payload.sponsor_name;
      document.getElementById('confirmMealDate').innerText = payload.sponsor_date;
      document.getElementById('confirmAmount').innerText = `₹${total.toLocaleString('en-IN')}`;
      document.getElementById('confirmMealItems').innerText = payload.selected_items;

      document.getElementById('mealBookingModal').classList.remove('hidden');
      document.getElementById('mealBookingModal').classList.add('flex');
      form.reset();
      selectedMeals.clear();
      applyMealPreset('lunch');
    } else {
      alert(result.error || 'Failed to submit booking. Please try again.');
    }
  } catch (err) {
    alert('Server error while saving reservation. Please contact us directly at +91 96772 38998.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
};

window.closeMealModal = function() {
  const modal = document.getElementById('mealBookingModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
};

// ── 7. DONATIONS & 80G RECORD FORM ───────────────────────────
window.setDonationPreset = function(amount, btn) {
  document.querySelectorAll('.don-preset-btn').forEach(b => b.classList.remove('bg-amber-600', 'text-white'));
  btn.classList.add('bg-amber-600', 'text-white');
  document.getElementById('donAmountInput').value = amount;
};

window.handleDonationSubmit = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('donSubmitBtn');
  const originalText = btn.innerHTML;

  const payload = {
    donor_name: document.getElementById('donName').value.trim(),
    donor_email: document.getElementById('donEmail').value.trim(),
    donor_phone: document.getElementById('donPhone').value.trim(),
    pan_number: document.getElementById('donPan').value.trim().toUpperCase(),
    amount: parseFloat(document.getElementById('donAmountInput').value) || 0,
    transfer_type: document.getElementById('donTransferType').value,
    reference_number: document.getElementById('donRef').value.trim(),
    notes: document.getElementById('donNotes').value.trim()
  };

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Saving Record...`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/donations/record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.ok) {
      document.getElementById('donSuccessBox').classList.remove('hidden');
      document.getElementById('donSuccessId').innerText = result.id;
      document.getElementById('donForm').reset();
      showToast('Donation record saved for 80G receipt!');
    } else {
      alert(result.error || 'Failed to submit donation.');
    }
  } catch (err) {
    alert('Server connection error. Please email us at premavasam1999@gmail.com.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
};

// ── 8. VOLUNTEER APPLICATION SUBMISSION ──────────────────────
window.handleVolunteerSubmit = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('volSubmitBtn');
  const originalText = btn.innerHTML;

  const payload = {
    full_name: document.getElementById('volFullName').value.trim(),
    phone: document.getElementById('volPhone').value.trim(),
    email: document.getElementById('volEmail').value.trim(),
    skills: document.getElementById('volSkills').value.trim(),
    message: document.getElementById('volMessage').value.trim()
  };

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Submitting...`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/volunteers/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.ok) {
      document.getElementById('volSuccessBox').classList.remove('hidden');
      document.getElementById('volForm').reset();
      showToast('Application received! Thank you.');
    } else {
      alert(result.error || 'Failed to submit application.');
    }
  } catch (err) {
    alert('Server connection error. Please call +91 96772 38998.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
};

// ── 9. CONTACT INQUIRY SUBMISSION ────────────────────────────
window.handleContactSubmit = async function(e) {
  e.preventDefault();
  const btn = document.getElementById('contactSubmitBtn');
  const originalText = btn.innerHTML;

  const payload = {
    name: document.getElementById('contactName').value.trim(),
    email: document.getElementById('contactEmail').value.trim(),
    subject: document.getElementById('contactSubject').value.trim(),
    message: document.getElementById('contactMessage').value.trim()
  };

  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-5 h-5 animate-spin"></i> Sending...`;
  if (window.lucide) lucide.createIcons();

  try {
    const res = await fetch('/api/contacts/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.ok) {
      document.getElementById('contactSuccessBox').classList.remove('hidden');
      document.getElementById('contactForm').reset();
      showToast('Message sent to Prema Vasam!');
    } else {
      alert(result.error || 'Failed to send message.');
    }
  } catch (err) {
    alert('Server connection error.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = originalText;
    if (window.lucide) lucide.createIcons();
  }
};

// ── 10. PHOTO GALLERY & FULLSCREEN LIGHTBOX ─────────────────
const GALLERY_DATA = [
  // Happy Schooling & Education (all 5 photos)
  { src: '/images/gallery/school_1.jpg', title: 'Classroom Learning & Alphabet ADL', cat: 'education' },
  { src: '/images/gallery/school_2.jpg', title: 'Creative Art & Clay Modeling', cat: 'education' },
  { src: '/images/gallery/school_3.jpg', title: 'Group Study & Interaction', cat: 'education' },
  { src: '/images/gallery/school_4.jpg', title: 'Sensory Teaching & Special Aids', cat: 'education' },
  { src: '/images/gallery/school_5.jpg', title: 'Focused Guidance & Writing Skills', cat: 'education' },
  { src: '/images/dance1.jpg', title: 'Kalakshetra Classical Bharatha Natyam', cat: 'education' },
  { src: '/images/dance2.jpg', title: 'Traditional Cultural Dance Performance', cat: 'education' },
  { src: '/images/achieve2_music.jpg', title: 'Drums & Rhythm Session', cat: 'education' },

  // Diwali 2024 & Celebrations (all 6 photos + Diwali special)
  { src: '/images/gallery/diwali_1.jpg', title: 'Festival of Lights Gathering', cat: 'celebration' },
  { src: '/images/gallery/diwali_2.jpg', title: 'Sweet Distribution & Festivities', cat: 'celebration' },
  { src: '/images/gallery/diwali_3.jpg', title: 'Joyful Family Gathering', cat: 'celebration' },
  { src: '/images/gallery/diwali_4.jpg', title: 'Lighting Festive Diyas Together', cat: 'celebration' },
  { src: '/images/gallery/diwali_5.jpg', title: 'Evening Sparklers & Crackers', cat: 'celebration' },
  { src: '/images/gallery/diwali_6.jpg', title: 'Diwali Sparkles & Joyful Smiles', cat: 'celebration' },
  { src: '/images/swathidiwali.png', title: 'Community Diwali Celebration with Swathi', cat: 'celebration' },
  { src: '/images/img_9718.jpg', title: 'Annual Day Celebrations & Speeches', cat: 'celebration' },

  // Sports Meet & Physical Activities (all 6 photos + play therapy)
  { src: '/images/gallery/sports_1.jpg', title: 'Opening Ceremony & March Past', cat: 'sports' },
  { src: '/images/gallery/sports_2.jpg', title: 'Track Events & Running Race', cat: 'sports' },
  { src: '/images/gallery/sports_3.jpg', title: 'Wheelchair Races & Champion Spirit', cat: 'sports' },
  { src: '/images/gallery/sports_4.jpg', title: 'Cheering Squad & Enthusiastic Support', cat: 'sports' },
  { src: '/images/gallery/sports_5.jpg', title: 'Medal & Trophy Distribution Ceremony', cat: 'sports' },
  { src: '/images/gallery/sports_6.jpg', title: 'Group Sports Victory Celebration', cat: 'sports' },
  { src: '/images/play_therapy.jpg', title: 'Play Therapy & Active Outdoor Games', cat: 'sports' },
  { src: '/images/play_therapy_sports.jpg', title: 'Athletic Training & Parallel Bar Walking', cat: 'sports' },

  // Our Children & Daily Life (all 5 photos + individual care)
  { src: '/images/gallery/children_1.jpg', title: 'Morning Smiles & Fresh Day Care', cat: 'daily' },
  { src: '/images/gallery/children_2.jpg', title: 'Courtyard Laughter & Free Play', cat: 'daily' },
  { src: '/images/gallery/children_3.jpg', title: 'Tender Companionship & Friendship', cat: 'daily' },
  { src: '/images/gallery/children_4.jpg', title: 'Moments of Pure Innocent Joy', cat: 'daily' },
  { src: '/images/gallery/children_5.jpg', title: 'Embraced with Compassion & Love', cat: 'daily' },
  { src: '/images/individual_care1.jpg', title: 'Dedicated Motherly Care & Feeding', cat: 'daily' },
  { src: '/images/individual_care3.jpg', title: 'Individual Physical Rehabilitation', cat: 'daily' },
  { src: '/images/individual_care4.jpg', title: 'Warm Affection & Daily Nursing', cat: 'daily' },
  { src: '/images/achieve_praveena.jpg', title: 'Milestone Walk: Praveena Triumphs', cat: 'daily' }
];

let curLightboxIdx = 0;
let filteredPhotos = [...GALLERY_DATA];

window.filterGallery = function(cat, btn) {
  document.querySelectorAll('.gal-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  filteredPhotos = (cat === 'all') ? [...GALLERY_DATA] : GALLERY_DATA.filter(p => p.cat === cat);
  renderGalleryGrid();
};

function renderGalleryGrid() {
  const grid = document.getElementById('galleryGrid');
  if (!grid) return;

  grid.innerHTML = filteredPhotos.map((photo, idx) => `
    <div class="group relative overflow-hidden rounded-2xl bg-stone-100 shadow-sm border border-stone-200/80 cursor-pointer" onclick="openLightbox(${idx})">
      <img src="${photo.src}" alt="${photo.title}" class="w-full h-56 object-cover transform group-hover:scale-105 transition duration-300" loading="lazy">
      <div class="absolute inset-0 bg-gradient-to-t from-stone-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition flex items-end p-4">
        <span class="text-white text-sm font-medium flex items-center gap-2">
          <i data-lucide="maximize-2" class="w-4 h-4 text-amber-400"></i> ${photo.title}
        </span>
      </div>
    </div>
  `).join('');

  if (window.lucide) lucide.createIcons();
}

window.openLightbox = function(idx) {
  curLightboxIdx = idx;
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImg');
  const title = document.getElementById('lightboxTitle');

  if (modal && filteredPhotos[idx]) {
    img.src = filteredPhotos[idx].src;
    title.innerText = filteredPhotos[idx].title;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    document.body.style.overflow = 'hidden';
  }
};

window.closeLightbox = function() {
  const modal = document.getElementById('lightboxModal');
  if (modal) {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    document.body.style.overflow = '';
  }
};

window.navigateLightbox = function(dir) {
  curLightboxIdx = (curLightboxIdx + dir + filteredPhotos.length) % filteredPhotos.length;
  const img = document.getElementById('lightboxImg');
  const title = document.getElementById('lightboxTitle');
  if (img && filteredPhotos[curLightboxIdx]) {
    img.src = filteredPhotos[curLightboxIdx].src;
    title.innerText = filteredPhotos[curLightboxIdx].title;
  }
};

// ── 11. INITIALIZATION ON LOAD ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Lucide Icons
  if (window.lucide) lucide.createIcons();

  // Set default date for meal booking (tomorrow)
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const dateInput = document.getElementById('mealSponsorDate');
  if (dateInput) {
    dateInput.min = tomorrow;
    dateInput.value = tomorrow;
  }

  // Calculate default meals tally
  calculateMealsTally();

  // Render gallery
  renderGalleryGrid();

  // Initialize Hero Carousel
  if (window.initHeroCarousel) window.initHeroCarousel();
});
// ── 12. HERO IMAGE CAROUSEL CONTROLLER ──────────────────────
let curHeroSlide = 0;
let heroCarouselTimer = null;

window.initHeroCarousel = function() {
  const container = document.getElementById('heroCarousel');
  const dotsBox = document.getElementById('heroDotsContainer');
  if (!container) return;

  const slides = container.querySelectorAll('.hero-slide');
  if (slides.length <= 1) return;

  if (dotsBox) {
    dotsBox.innerHTML = '';
    slides.forEach((_, idx) => {
      const dot = document.createElement('button');
      dot.className = `w-2 h-2 rounded-full transition-all ${idx === 0 ? 'w-5 bg-amber-400' : 'bg-white/60 hover:bg-white'}`;
      dot.setAttribute('aria-label', `Slide ${idx + 1}`);
      dot.onclick = () => { goToHeroSlide(idx); resetHeroTimer(); };
      dotsBox.appendChild(dot);
    });
  }

  function goToHeroSlide(idx) {
    curHeroSlide = (idx + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      if (i === curHeroSlide) {
        slide.classList.remove('opacity-0', 'pointer-events-none');
        slide.classList.add('opacity-100');
      } else {
        slide.classList.remove('opacity-100');
        slide.classList.add('opacity-0', 'pointer-events-none');
      }
    });

    if (dotsBox) {
      const dots = dotsBox.querySelectorAll('button');
      dots.forEach((dot, i) => {
        if (i === curHeroSlide) {
          dot.className = 'w-5 h-2 rounded-full bg-amber-400 transition-all';
        } else {
          dot.className = 'w-2 h-2 rounded-full bg-white/60 hover:bg-white transition-all';
        }
      });
    }
  }

  function resetHeroTimer() {
    clearInterval(heroCarouselTimer);
    heroCarouselTimer = setInterval(() => {
      goToHeroSlide(curHeroSlide + 1);
    }, 4500);
  }

  window.nextHeroSlide = function() {
    goToHeroSlide(curHeroSlide + 1);
    resetHeroTimer();
  };

  window.prevHeroSlide = function() {
    goToHeroSlide(curHeroSlide - 1);
    resetHeroTimer();
  };

  // ── Touch Swipe Gestures for Mobile Platforms ──
  let touchStartX = 0;
  let touchStartY = 0;
  let touchEndX = 0;
  let touchEndY = 0;

  container.addEventListener('touchstart', (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      touchStartX = e.changedTouches[0].clientX;
      touchStartY = e.changedTouches[0].clientY;
    }
  }, { passive: true });

  container.addEventListener('touchend', (e) => {
    if (e.changedTouches && e.changedTouches.length > 0) {
      touchEndX = e.changedTouches[0].clientX;
      touchEndY = e.changedTouches[0].clientY;
      const diffX = touchEndX - touchStartX;
      const diffY = touchEndY - touchStartY;
      // Ensure horizontal swipe is dominant (not vertical scroll)
      if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY)) {
        if (diffX < 0) {
          window.nextHeroSlide();
        } else {
          window.prevHeroSlide();
        }
      }
    }
  }, { passive: true });

  resetHeroTimer();
};

