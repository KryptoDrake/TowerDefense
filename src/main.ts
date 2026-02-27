import { Game } from './game/Game';

// Wait for DOM to be ready
document.addEventListener('DOMContentLoaded', () => {
  const loadingScreen = document.getElementById('loading-screen');
  const progressBar = document.getElementById('ls-progress');

  // Helper to set progress bar width
  function setProgress(pct: number): void {
    if (progressBar) {
      progressBar.style.width = `${Math.min(pct, 100)}%`;
    }
  }

  // Simulate early progress ticks while imports resolve
  setProgress(10);

  // Use requestAnimationFrame to let the browser paint the loading screen
  // before we block on heavy constructor work
  requestAnimationFrame(() => {
    setProgress(20);

    // Another rAF to ensure the 20% paint is flushed
    requestAnimationFrame(() => {
      setProgress(40);

      // Small timeout so the 40% bar renders before the heavy Game constructor
      setTimeout(() => {
        setProgress(60);

        const game = new Game();

        setProgress(90);

        // Dismiss loading screen
        if (loadingScreen) {
          setProgress(100);

          // Allow the 100% bar to visually fill before fading
          setTimeout(() => {
            loadingScreen.classList.add('ls-hidden');

            // Remove the element entirely once the fade-out transition ends
            loadingScreen.addEventListener('transitionend', () => {
              loadingScreen.remove();
            }, { once: true });
          }, 300);
        }

        game.start();
      }, 50);
    });
  });
});
