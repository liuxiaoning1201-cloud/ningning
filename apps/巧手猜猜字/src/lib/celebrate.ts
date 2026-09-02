import confetti from 'canvas-confetti';

/**
 * 官網 Stars 模式：https://www.kirilv.com/canvas-confetti/
 * 黃金星星連噴三次，拼完一個字時用來喝采。
 */
export function celebrateStars() {
  const defaults = {
    spread: 360,
    ticks: 50,
    gravity: 0,
    decay: 0.94,
    startVelocity: 30,
    colors: ['FFE400', 'FFBD00', 'E89400', 'FFCA6C', 'FDFFB8'],
    disableForReducedMotion: true,
  };

  const shoot = () => {
    void confetti({
      ...defaults,
      particleCount: 40,
      scalar: 1.2,
      shapes: ['star'],
    });
    void confetti({
      ...defaults,
      particleCount: 10,
      scalar: 0.75,
      shapes: ['circle'],
    });
  };

  shoot();
  window.setTimeout(shoot, 100);
  window.setTimeout(shoot, 200);
}
