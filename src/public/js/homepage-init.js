// Homepage: initialize Usage Pill
document.addEventListener('DOMContentLoaded', function() {
  if (window.UsagePill) {
    window.UsagePill.create('#usagePillContainer', {
      mode: 'inline',
      showReports: false,
      showUpgradeLink: true
    });
  }
});
