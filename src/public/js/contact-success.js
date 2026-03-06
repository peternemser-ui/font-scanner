// Contact form: show success state if redirected back after send
(function() {
  if (window.location.search.includes('sent=true')) {
    var form = document.getElementById('contactForm');
    var success = document.getElementById('contactSuccess');
    if (form) form.style.display = 'none';
    if (success) success.style.display = 'block';
  }
})();
