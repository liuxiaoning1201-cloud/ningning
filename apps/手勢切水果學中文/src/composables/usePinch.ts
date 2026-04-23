/**
 * 食指拇指捏合（雙閾值）＋指尖命中點（鏡像後螢幕座標）
 */

const CLOSE = 0.062;
const OPEN = 0.092;

export interface PinchSample {
  pinch: boolean;
  /** 螢幕像素座標，已鏡像（適合自拍鏡頭） */
  cx: number;
  cy: number;
}

export function createPinchSmoother() {
  let latched = false;

  function update(
    landmarks: Array<{ x: number; y: number }> | undefined,
    width: number,
    height: number
  ): PinchSample | null {
    if (!landmarks || landmarks.length < 9) return null;

    const thumb = landmarks[4];
    const index = landmarks[8];
    const dx = thumb.x - index.x;
    const dy = thumb.y - index.y;
    const dist = Math.hypot(dx, dy);

    if (!latched && dist < CLOSE) latched = true;
    else if (latched && dist > OPEN) latched = false;

    const px = (1 - index.x) * width;
    const py = index.y * height;

    return {
      pinch: latched,
      cx: px,
      cy: py,
    };
  }

  function reset() {
    latched = false;
  }

  return { update, reset };
}
