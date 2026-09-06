import * as T from 'three';

/** Space the interface occupies, so framing centres on what is actually visible. */
export interface Insets {left: number; right: number; top: number; bottom: number}

export interface Framing {target: T.Vector3; position: T.Vector3; offset: {x: number; y: number} | null; distance: number}

const easeInOutCubic = (t: number) => (t < .5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Distance at which `size` fills the space left over by the interface. */
export function frameBox(box: T.Box3, camera: T.PerspectiveCamera, viewport: {width: number; height: number}, insets: Insets, padding = 1.35): Framing {
  const center = box.getCenter(new T.Vector3());
  const size = box.getSize(new T.Vector3());
  const {width, height} = viewport;
  const availableWidth = Math.max(150, width - insets.left - insets.right);
  const availableHeight = Math.max(80, height - insets.top - insets.bottom);
  const halfFov = T.MathUtils.degToRad(camera.fov / 2);

  // Scale the requirement by how much of the frame the interface has taken.
  const distance = Math.max(.06, Math.max(
    size.y * height / availableHeight,
    size.x * width / availableWidth / camera.aspect,
    size.z,
  ) / (2 * Math.tan(halfFov)) * padding);

  return {
    target: center,
    position: center.clone(),
    distance,
    offset: {
      x: width / 2 - (insets.left + (width - insets.right)) / 2,
      y: height / 2 - (insets.top + (height - insets.bottom)) / 2,
    },
  };
}

/** An interruptible camera move.
 *
 * Position is interpolated in spherical coordinates about the moving target so
 * the camera arcs around the body instead of cutting a straight line through
 * it. Distance eases on its own curve and pulls back slightly at the midpoint,
 * which is what reads as deliberate rather than mechanical.
 */
export class CameraFlight {
  private from = {target: new T.Vector3(), spherical: new T.Spherical()};
  private to = {target: new T.Vector3(), spherical: new T.Spherical()};
  private elapsed = 0;
  private duration = 0;
  active = false;

  start(camera: T.PerspectiveCamera, currentTarget: T.Vector3, target: T.Vector3, distance: number, direction: T.Vector3, duration = .95) {
    this.from.target.copy(currentTarget);
    this.from.spherical.setFromVector3(camera.position.clone().sub(currentTarget));
    this.to.target.copy(target);
    this.to.spherical.setFromVector3(direction.clone().normalize().multiplyScalar(distance));
    // Take the short way round.
    const delta = this.to.spherical.theta - this.from.spherical.theta;
    if (delta > Math.PI) this.to.spherical.theta -= Math.PI * 2;
    else if (delta < -Math.PI) this.to.spherical.theta += Math.PI * 2;
    this.elapsed = 0;
    this.duration = duration;
    this.active = true;
  }

  cancel() { this.active = false; }

  /** Advance the flight. Returns false once there is nothing left to do. */
  step(dt: number, camera: T.PerspectiveCamera, target: T.Vector3): boolean {
    if (!this.active) return false;
    this.elapsed = Math.min(this.elapsed + dt, this.duration);
    const t = easeInOutCubic(this.elapsed / this.duration);

    target.lerpVectors(this.from.target, this.to.target, t);

    const spherical = new T.Spherical(
      T.MathUtils.lerp(this.from.spherical.radius, this.to.spherical.radius, t),
      T.MathUtils.lerp(this.from.spherical.phi, this.to.spherical.phi, t),
      T.MathUtils.lerp(this.from.spherical.theta, this.to.spherical.theta, t),
    );
    // Ease out and back in, so the move breathes instead of sliding.
    spherical.radius *= 1 + Math.sin(t * Math.PI) * .12;
    camera.position.copy(target).add(new T.Vector3().setFromSpherical(spherical));

    if (this.elapsed >= this.duration) this.active = false;
    return true;
  }
}

export interface LabelAnchor {key: string; text: string; role: 'primary' | 'secondary'; x: number; y: number}

/** Push overlapping labels apart vertically, keeping their reading order.
 * One axis is enough: anchors are already spread horizontally by the anatomy,
 * and moving a label sideways breaks the association with its leader line. */
export function layoutLabels(anchors: LabelAnchor[], height: number, spacing = 26): LabelAnchor[] {
  const placed = anchors.slice().sort((a, b) => a.y - b.y);
  for (let i = 1; i < placed.length; i++) {
    const gap = placed[i].y - placed[i - 1].y;
    if (gap < spacing) placed[i].y = placed[i - 1].y + spacing;
  }
  const overflow = placed.length ? placed[placed.length - 1].y - (height - 16) : 0;
  if (overflow > 0) for (const anchor of placed) anchor.y -= overflow;
  for (const anchor of placed) anchor.y = Math.max(16, anchor.y);
  return placed;
}
