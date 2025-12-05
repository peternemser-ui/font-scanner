/**
 * ASCII Art Background Animation System
 * Displays entertaining fireworks, UFOs, and aliens during analysis
 */

class ASCIIBackgroundAnimation {
  constructor() {
    this.container = null;
    this.animationInterval = null;
    this.isActive = false;
    this.particles = [];
  }

  /**
   * Initialize and start the background animation
   */
  start() {
    if (this.isActive) return;

    this.isActive = true;
    this.createContainer();
    this.animate();
  }

  /**
   * Stop and cleanup the animation
   */
  stop() {
    if (!this.isActive) return;

    this.isActive = false;
    if (this.animationInterval) {
      clearInterval(this.animationInterval);
      this.animationInterval = null;
    }

    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }

    this.particles = [];
    this.container = null;
  }

  /**
   * Create the background container
   */
  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'ascii-background';
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 1;
      overflow: hidden;
      opacity: 0.3;
    `;
    document.body.appendChild(this.container);
  }

  /**
   * Main animation loop
   */
  animate() {
    // Spawn new particles occasionally
    if (Math.random() < 0.15) {
      this.spawnParticle();
    }

    // Update all particles
    this.particles = this.particles.filter(particle => {
      particle.update();
      return particle.isAlive();
    });

    // Render
    this.render();

    // Continue animation
    if (this.isActive) {
      setTimeout(() => this.animate(), 150);
    }
  }

  /**
   * Spawn a random particle
   */
  spawnParticle() {
    const types = ['firework', 'ufo', 'alien'];
    const type = types[Math.floor(Math.random() * types.length)];

    const particle = new ASCIIParticle(type);
    this.particles.push(particle);
  }

  /**
   * Render all particles
   */
  render() {
    if (!this.container) return;

    // Clear container
    this.container.innerHTML = '';

    // Render each particle
    this.particles.forEach(particle => {
      const element = particle.render();
      if (element) {
        this.container.appendChild(element);
      }
    });
  }
}

/**
 * Individual ASCII particle
 */
class ASCIIParticle {
  constructor(type) {
    this.type = type;
    this.x = Math.random() * 90; // percentage
    this.y = Math.random() < 0.5 ? -10 : 110; // Start off screen
    this.vx = (Math.random() - 0.5) * 2;
    this.vy = this.y < 0 ? Math.random() * 3 + 1 : -(Math.random() * 3 + 1);
    this.life = 100;
    this.maxLife = 100;
    this.frame = 0;
    this.color = this.getRandomColor();
  }

  getRandomColor() {
    const colors = ['#00ff41', '#00ffff', '#ff00ff', '#ffff00', '#ff6600'];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life--;
    this.frame++;

    // Bounce off edges
    if (this.x < 0 || this.x > 100) {
      this.vx *= -1;
    }
  }

  isAlive() {
    return this.life > 0 && this.y > -20 && this.y < 120;
  }

  getArt() {
    switch (this.type) {
      case 'firework':
        return this.getFirework();
      case 'ufo':
        return this.getUFO();
      case 'alien':
        return this.getAlien();
      default:
        return '*';
    }
  }

  getFirework() {
    const stage = Math.floor(this.frame / 5) % 4;
    const fireworks = [
      '✦',
      '✧',
      '✨',
      '*'
    ];
    return fireworks[stage];
  }

  getUFO() {
    const ufos = [
      `
  .-"-.
 /=   =\\
/_______\\`,
      `
  .-"-.
 ( o o )
 \\  ^  /
  '---'`,
      `
    _
  /   \\
 |  O  |
  \\___/`
    ];
    return ufos[Math.floor(this.frame / 8) % ufos.length];
  }

  getAlien() {
    const aliens = [
      `
 /\\_/\\
( o.o )
 > ^ <`,
      `
 .---.
(  @  @)
 |  >  |
  '---'`,
      `
  ^   ^
 (0   0)
   ===`
    ];
    return aliens[Math.floor(this.frame / 10) % aliens.length];
  }

  render() {
    const element = document.createElement('div');
    element.style.cssText = `
      position: absolute;
      left: ${this.x}%;
      top: ${this.y}%;
      color: ${this.color};
      font-family: monospace;
      font-size: ${12 + Math.random() * 8}px;
      white-space: pre;
      text-shadow: 0 0 10px ${this.color};
      opacity: ${this.life / this.maxLife};
      transform: translate(-50%, -50%);
    `;
    element.textContent = this.getArt();
    return element;
  }
}

// Global instance
window.asciiBackground = new ASCIIBackgroundAnimation();

// Auto-start when loading states are detected, auto-stop when complete
document.addEventListener('DOMContentLoaded', () => {
  // Watch for loading containers appearing and disappearing
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      // Check for added nodes (loading starts)
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          // Check if loading state is active
          if (node.id === 'loadingContainer' ||
              node.classList?.contains('analyzer-loading') ||
              node.querySelector?.('[id*="loading"]')) {
            window.asciiBackground.start();
          }
        }
      });

      // Check for removed nodes (loading ends)
      mutation.removedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          if (node.id === 'loadingContainer' ||
              node.classList?.contains('analyzer-loading') ||
              node.querySelector?.('[id*="loading"]')) {
            window.asciiBackground.stop();
          }
        }
      });

      // Check for attribute changes (display: none means loading ended)
      if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
        const target = mutation.target;
        if (target.id === 'loadingContainer' ||
            target.classList?.contains('analyzer-loading') ||
            target.id?.includes('loading')) {
          const style = window.getComputedStyle(target);
          if (style.display === 'none') {
            window.asciiBackground.stop();
          }
        }
      }

      // Check for class changes (hidden class means loading ended)
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        const target = mutation.target;
        if (target.id === 'loadingContainer' ||
            target.id?.includes('loading')) {
          if (target.classList.contains('hidden') || target.style.display === 'none') {
            window.asciiBackground.stop();
          }
        }
      }
    });

    // Additional check: if results container becomes visible, stop animation
    const resultsContainers = document.querySelectorAll('[id*="results"], [id*="Results"]');
    resultsContainers.forEach(container => {
      const style = window.getComputedStyle(container);
      if (style.display !== 'none' && container.innerHTML.trim().length > 0) {
        // Results are visible, stop animation
        window.asciiBackground.stop();
      }
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class']
  });

  // Also listen for analyze button clicks
  document.addEventListener('click', (e) => {
    if (e.target.id === 'analyzeButton' ||
        e.target.textContent?.includes('ANALYZ')) {
      setTimeout(() => window.asciiBackground.start(), 100);
    }
  });

  // Periodic check to ensure animation stops when loading completes
  setInterval(() => {
    if (window.asciiBackground.isActive) {
      const loadingContainers = document.querySelectorAll('#loadingContainer, [id*="loading"]');
      let anyVisible = false;

      loadingContainers.forEach(container => {
        const style = window.getComputedStyle(container);
        if (style.display !== 'none' && !container.classList.contains('hidden')) {
          anyVisible = true;
        }
      });

      // If no loading containers are visible, stop the animation
      if (!anyVisible) {
        window.asciiBackground.stop();
      }
    }
  }, 1000); // Check every second
});
