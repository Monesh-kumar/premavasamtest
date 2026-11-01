/**
 * Prema Vasam - Mobile Navigation Handler
 * Seamless slide-in menu drawer with touch-friendly interactions
 */
(function() {
  function initMobileNav() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navMenu = document.getElementById('navMenu');

    if (!mobileBtn || !navMenu) return;

    mobileBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      const isOpen = navMenu.classList.toggle('open');
      mobileBtn.innerHTML = isOpen ? '&times;' : '&#9776;';
      mobileBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
      mobileBtn.classList.toggle('active', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    // Close when tapping any nav link
    navMenu.querySelectorAll('a').forEach(function(link) {
      link.addEventListener('click', function() {
        navMenu.classList.remove('open');
        mobileBtn.innerHTML = '&#9776;';
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.classList.remove('active');
        document.body.style.overflow = '';
      });
    });

    // Close when clicking outside
    document.addEventListener('click', function(e) {
      if (navMenu.classList.contains('open') && !navMenu.contains(e.target) && e.target !== mobileBtn) {
        navMenu.classList.remove('open');
        mobileBtn.innerHTML = '&#9776;';
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.classList.remove('active');
        document.body.style.overflow = '';
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && navMenu.classList.contains('open')) {
        navMenu.classList.remove('open');
        mobileBtn.innerHTML = '&#9776;';
        mobileBtn.setAttribute('aria-expanded', 'false');
        mobileBtn.classList.remove('active');
        document.body.style.overflow = '';
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
