import { createAnatomyMaterial, createSelectionColors } from "./rendering/materials";
import { selectionColorPreset } from "./core/selection-colors";
import { updateDrawBatches, type DrawBatch } from "./rendering/draw-batches";
import { useEffect, useRef } from "react";
import * as T from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createExplosionLayout, createSystemSeparationLayout } from "./core/explosion-layout";
import { decodeModelResponse } from "./core/model-download";
import { prepareShaders } from "./core/shader-preparation";
import { staticAssetUrl } from "./core/static-asset";
import { PointerTap } from "./core/pointer-tap";
import { isPartVisible } from "./core/privacy-mode";
import { SYSTEMS, type Atlas, type SceneState } from "./core/anatomy";
import { displayName, text, type Locale } from "../client/i18n";
interface Props {
  atlas: Atlas;
  state: SceneState;
  locale: Locale;
  onSelect: (id: string) => void;
  onProgress: (n: number) => void;
  onError: (s: string) => void;
}
export default function AnatomyScene({
  atlas,
  state,
  locale,
  onSelect,
  onProgress,
  onError,
}: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(state),
    select = useRef(onSelect),
    language = useRef(locale),
    wake = useRef<() => void>(() => {});
  useEffect(() => {
    wake.current();
  }, [state]);
  language.current = locale;
  useEffect(() => {
    const canvas = host.current?.querySelector("canvas");
    canvas?.setAttribute(
      "aria-label",
      text(
        "Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.",
        locale,
      ),
    );
    const hover = host.current?.querySelector<HTMLElement>(".part-hover");
    if (hover) hover.hidden = true;
  }, [locale]);
  latest.current = state;
  select.current = onSelect;
  useEffect(() => {
    const el = host.current!;
    let disposed = false,
      contextUnavailable = false,
      frame = 0,
      dirty = true,
      ready = false,
      lastView = "",
      lastReset = -1,
      lastSelectionFrame = "",
      layoutKey = "",
      amount = 0;
    let lastState: SceneState | null = null;
    let animate: (time: number) => void = () => {};
    let lastTime = 0;
    const requestFrame = () => {
      if (!disposed && !document.hidden && !frame)
        frame = requestAnimationFrame((time) => animate(time));
    };
    wake.current = requestFrame;
    const abort = new AbortController();
    let renderer: T.WebGLRenderer;
    try {
      renderer = new T.WebGLRenderer({
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      onError(
        "This browser could not start the 3D viewer. Please try a browser with WebGL enabled.",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, innerWidth < 768 ? 1.5 : 2));
    renderer.setClearColor("#f3f6f5");
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    el.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      text(
        "Interactive human anatomy. Drag to orbit, pinch or scroll to zoom, and tap a structure to inspect it.",
        language.current,
      ),
    );
    const scene = new T.Scene(),
      camera = new T.PerspectiveCamera(34, 1, 0.005, 100),
      controls = new OrbitControls(camera, renderer.domElement);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let cameraTransition: {
      start: number;
      position: T.Vector3;
      target: T.Vector3;
      destination: T.Vector3;
      center: T.Vector3;
      offset: T.Vector2;
      destinationOffset: T.Vector2;
      orbit?: boolean;
    } | null = null;
    let surroundingView: { position: T.Vector3; target: T.Vector3; aspect: number } | null = null;
    camera.position.set(1.4, 1.05, 3.6);
    controls.target.set(0, 0.85, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.minDistance = 0.07;
    controls.maxDistance = 40;
    controls.maxPolarAngle = Math.PI * 0.96;
    controls.addEventListener("change", () => {
      dirty = true;
      requestFrame();
    });
    controls.addEventListener("start", () => {
      // A drag, pinch or wheel gesture takes over from the guided movement.
      cameraTransition = null;
      requestFrame();
    });
    controls.addEventListener("end", () => {
      requestFrame();
    });
    const pmrem = new T.PMREMGenerator(renderer),
      room = new RoomEnvironment(),
      env = pmrem.fromScene(room, 0.04);
    scene.environment = env.texture;
    room.dispose();
    pmrem.dispose();
    scene.add(new T.HemisphereLight(0xffffff, 0xa7acb2, 1.05));
    const key = new T.DirectionalLight(0xfffaf4, 2.3);
    key.position.set(-2, 4, 3);
    scene.add(key);
    const rim = new T.DirectionalLight(0xe9f0ff, 1.8);
    rim.position.set(2, 2, -3);
    scene.add(rim);
    const ground = new T.Mesh(
      new T.CircleGeometry(0.76, 96),
      new T.MeshStandardMaterial({ color: 0xe7eee9, roughness: 1, transparent: true, opacity: 0.25 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.019;
    scene.add(ground);
    const platform = new T.Mesh(
      new T.CylinderGeometry(0.68, 0.7, 0.028, 100),
      new T.MeshStandardMaterial({ color: 0xeeeeec, metalness: 0.12, roughness: 0.67 }),
    );
    platform.position.y = -0.016;
    scene.add(platform);
    const ring = new T.Mesh(
      new T.RingGeometry(0.63, 0.632, 128),
      new T.MeshBasicMaterial({
        color: 0x8c969f,
        transparent: true,
        opacity: 0.4,
        side: T.DoubleSide,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.001;
    scene.add(ring);
    const innerRing = new T.Mesh(
      new T.RingGeometry(0.55, 0.551, 128),
      new T.MeshBasicMaterial({
        color: 0xa4aeb8,
        transparent: true,
        opacity: 0.16,
        side: T.DoubleSide,
      }),
    );
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.001;
    scene.add(innerRing);
    const width = T.MathUtils.ceilPowerOfTwo(atlas.parts.length),
      data = new Float32Array(width * 4),
      partTexture = new T.DataTexture(data, width, 1, T.RGBAFormat, T.FloatType);
    partTexture.needsUpdate = true;
    const selectedData = new Uint8Array(width * 4),
      selectionTexture = new T.DataTexture(selectedData, width, 1);
    selectionTexture.needsUpdate = true;
    const materials: T.Material[] = [],
      geometries: T.BufferGeometry[] = [],
      pickers: (T.Mesh | undefined)[] = [],
      centers = atlas.parts.map((p) =>
        new T.Vector3()
          .fromArray(p.bounds[0])
          .add(new T.Vector3().fromArray(p.bounds[1]))
          .multiplyScalar(0.5),
      );
    const offsets: T.Vector3[] = [],
      bounds = atlas.parts.map(
        (p) =>
          new T.Box3(
            new T.Vector3().fromArray(p.bounds[0]),
            new T.Vector3().fromArray(p.bounds[1]),
          ),
      );
    const selectionColors = createSelectionColors(latest.current.selectionColor);
    let lastSelectionColor = latest.current.selectionColor;
    const contextHighlight = new T.Group();
    const contextHighlightMaterial = new T.MeshBasicMaterial({
      color: selectionColors.edge, transparent: true, opacity: 0.65,
      depthWrite: false, depthFunc: T.GreaterDepth,
    });
    materials.push(contextHighlightMaterial);
    scene.add(contextHighlight);
    let contextHighlightKey = "";
    let systemLayout = createSystemSeparationLayout(atlas.parts);
    let activeParts: number[] = [],
      selectedIndices: number[] = [],
      hasSolidParts = false,
      selectedKey = "";
    let packingWidth = 1,
      packingHeight = 1;
    const markerPositions = new Float32Array(atlas.parts.length * 3),
      markerGeometry = new T.BufferGeometry();
    markerGeometry.setAttribute("position", new T.BufferAttribute(markerPositions, 3));
    const markerMaterial = new T.PointsMaterial({
      color: 0x64748b,
      size: 5,
      sizeAttenuation: false,
      transparent: true,
      opacity: 0.72,
      depthTest: false,
    });
    markerMaterial.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        "#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;",
      );
    };
    const markers = new T.Points(markerGeometry, markerMaterial);
    markers.frustumCulled = false;
    markers.renderOrder = 10;
    markers.visible = false;
    scene.add(markers);
    const hover = document.createElement("div");
    hover.className = "part-hover";
    hover.setAttribute("role", "tooltip");
    hover.hidden = true;
    el.appendChild(hover);
    type Target = {
      index: number;
      x: number;
      y: number;
      left: number;
      right: number;
      top: number;
      bottom: number;
    };
    let targets: Target[] = [];
    let targetsDirty = true;
    let refreshTargets = () => {};
    const projected = new T.Vector3();
    const findTarget = (x: number, y: number, radius: number) => {
      if (targetsDirty) refreshTargets();
      let best = -1,
        score = Infinity;
      for (const t of targets) {
        const dx = Math.max(t.left - x, 0, x - t.right),
          dy = Math.max(t.top - y, 0, y - t.bottom),
          distance = Math.hypot(dx, dy);
        if (distance > radius) continue;
        const candidate = distance + Math.hypot(t.x - x, t.y - y) * 0.025;
        if (candidate < score) {
          score = candidate;
          best = t.index;
        }
      }
      return best;
    };
    const mats = new Map(
      SYSTEMS.map((system) => {
        const material = createAnatomyMaterial(system.id, partTexture, selectionTexture, width, selectionColors);
        materials.push(material);
        return [system.id, material];
      }),
    );
    // Compile against the final lights and environment while chunks download.
    // Real meshes are kept hidden until this finishes, so they cannot force a
    // synchronous shader link on the first frame. Unsupported GPUs fall back.
    const warmupGeometry = new T.BufferGeometry();
    warmupGeometry.setAttribute("position", new T.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    warmupGeometry.setAttribute("normal", new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
    warmupGeometry.setAttribute("partIndex", new T.Float32BufferAttribute([0, 0, 0], 1));
    const warmupGroup = new T.Group();
    mats.forEach((material) => warmupGroup.add(new T.Mesh(warmupGeometry, material)));
    let shadersReady = !renderer.extensions.has("KHR_parallel_shader_compile");
    const shaderPreparation = prepareShaders(!shadersReady,
      () => renderer.compileAsync(warmupGroup, camera, scene), abort.signal)
      .finally(() => {
        warmupGeometry.dispose();
        if (!disposed && !contextUnavailable) {
          shadersReady = true;
          lastState = null;
          dirty = true;
          requestFrame();
        }
      });
    const batches: DrawBatch[] = [];
    const partVisibility = new Uint8Array(atlas.parts.length);
    let loaded = 0;
    const loadChunk = async (ci: number) => {
      const chunk = atlas.chunks[ci],
        compressed = !!chunk.gzip;
      const response = await fetch(staticAssetUrl(compressed ? chunk.gzip! : chunk.url), { signal: abort.signal });
      const buffer = await decodeModelResponse(response, chunk.bytes, compressed);
      if (disposed || contextUnavailable) return;
      const groups = new Map<string, { geometry: T.BufferGeometry; part: number }[]>();
      atlas.parts.forEach((p, i) => {
        if (p.chunk !== ci) return;
        const g = new T.BufferGeometry();
        g.setAttribute(
          "position",
          new T.BufferAttribute(new Float32Array(buffer, p.positions, p.vertexCount * 3), 3),
        );
        // GPU normalized signed-short normals keep the complete atlas compact in memory.
        g.setAttribute(
          "normal",
          new T.BufferAttribute(new Int16Array(buffer, p.normals, p.vertexCount * 3), 3, true),
        );
        g.setIndex(new T.BufferAttribute(new Uint32Array(buffer, p.indices, p.indexCount), 1));
        g.boundingBox = bounds[i].clone();
        g.computeBoundingSphere();
        const pick = new T.Mesh(g);
        pick.matrixAutoUpdate = false;
        pickers[i] = pick;
        geometries.push(g);
        g.setAttribute(
          "partIndex",
          new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i), 1),
        );
        const list = groups.get(p.system) ?? [];
        list.push({ geometry: g, part: i });
        groups.set(p.system, list);
      });
      groups.forEach((gs, system) => {
        const geometry = mergeGeometries(
          gs.map((entry) => entry.geometry),
          false,
        );
        if (!geometry) throw new Error("Could not assemble anatomy geometry.");
        geometries.push(geometry);
        const mesh = new T.Mesh(geometry, mats.get(system as never));
        mesh.frustumCulled = false;
        // Start hidden until the current state is applied, including when a
        // user switches systems while chunks are still arriving.
        mesh.visible = false;
        const index = geometry.getIndex()!;
        const source = new Uint32Array(index.array);
        const drawIndex = new T.BufferAttribute(new Uint32Array(source.length), 1);
        drawIndex.setUsage(T.DynamicDrawUsage);
        geometry.setIndex(drawIndex);
        geometry.setDrawRange(0, 0);
        let start = 0;
        const spans = gs.map((entry) => {
          const count = atlas.parts[entry.part].indexCount;
          const span = { part: entry.part, start, count, visible: 0 };
          start += count;
          return span;
        });
        batches.push({ mesh, source, index: drawIndex, spans });
        scene.add(mesh);
      });
      lastState = null;
      loaded++;
      onProgress(Math.min(99, Math.round((loaded / atlas.chunks.length) * 100)));
      dirty = true;
      requestFrame();
    };
    (async () => {
      try {
        let cursor = 0;
        await Promise.all(
          Array.from({ length: 3 }, async () => {
            while (cursor < atlas.chunks.length) {
              const i = cursor++;
              await loadChunk(i);
            }
          }),
        );
        await shaderPreparation;
        if (!disposed && !contextUnavailable) {
          ready = true;
          onProgress(100);
          dirty = true;
          requestFrame();
        }
      } catch (e) {
        if (!disposed && !contextUnavailable) onError(e instanceof Error ? e.message : "Could not load the anatomy.");
      }
    })();
    const viewDirection = (view: string) => (
      view === "front" ? new T.Vector3(0, 0.02, 1)
        : view === "back" ? new T.Vector3(0, 0.02, -1)
          : view === "side" ? new T.Vector3(1, 0.02, 0)
            : new T.Vector3(0.35, 0.06, 1)
    ).normalize();
    const fit = (view: string, extent = 0, transitionTime?: number) => {
      controls.maxDistance = 40;
      controls.minDistance = 0.07;
      camera.near = 0.005;
      camera.updateProjectionMatrix();
      // The scene now occupies the space between the tool panels. Fit its own
      // viewport rather than reserving space for controls inside a full-screen canvas.
      const aspect = camera.aspect,
        normalDistance = Math.max(1.95, 1.05 / aspect) /
          (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) * 1.12;
      const atlasDistance =
        Math.max(packingHeight, packingWidth / aspect) /
          (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) * 1.12;
      const systemDistance = Math.max(systemLayout.height, (systemLayout.width + systemLayout.depth) / aspect) /
        (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2))) * 1.12;
      const distance = extent <= 0.5
        ? T.MathUtils.lerp(normalDistance, Math.max(normalDistance, systemDistance), extent / 0.5)
        : T.MathUtils.lerp(Math.max(normalDistance, systemDistance), Math.max(0.2, atlasDistance), (extent - 0.5) / 0.5);
      if (extent > 0.8) view = "front";
      const direction = viewDirection(view);
      const center = new T.Vector3(0, 0.85, 0);
      const destination = center.clone().addScaledVector(direction, distance);
      controls.autoRotate = false;
      controls.enableDamping = false;
      controls.update();
      if (transitionTime !== undefined && !reducedMotion.matches) {
        cameraTransition = {
          start: transitionTime,
          position: camera.position.clone(), target: controls.target.clone(),
          destination, center,
          offset: new T.Vector2(camera.view?.enabled ? camera.view.offsetX : 0, camera.view?.enabled ? camera.view.offsetY : 0),
          destinationOffset: new T.Vector2(), orbit: true,
        };
        dirty = true;
        return;
      }
      cameraTransition = null;
      camera.clearViewOffset();
      controls.target.copy(center);
      camera.position.copy(destination);
      controls.update();
      dirty = true;
    };
    const resize = () => {
      layoutKey = "";
      lastSelectionFrame = "";
      lastState = null;
      renderer.setPixelRatio(
        Math.min(devicePixelRatio, el.clientWidth < 768 || el.clientHeight < 600 ? 1.5 : 2),
      );
      camera.aspect = el.clientWidth / el.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(el.clientWidth, el.clientHeight);
      fit(latest.current.view, amount);
      requestFrame();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el);
    const raycaster = new T.Raycaster(),
      pointer = new T.Vector2(),
      tap = new PointerTap(),
      worldBox = new T.Box3(),
      hitPoint = new T.Vector3();
    const isolationBounds = new T.Box3();
    const down = (e: PointerEvent) => {
      hover.hidden = true;
      tap.down(e.pointerId, e.clientX, e.clientY, e.pointerType === "touch" ? 12 : 5);
    };
    const move = (e: PointerEvent) => {
      tap.move(e.pointerId, e.clientX, e.clientY);
      if (e.buttons || amount < 0.5 || e.pointerType === "touch") {
        hover.hidden = true;
        return;
      }
      const rect = el.getBoundingClientRect(),
        x = e.clientX - rect.left,
        y = e.clientY - rect.top,
        index = findTarget(x, y, 12);
      hover.hidden = index < 0;
      renderer.domElement.style.cursor = index < 0 ? "grab" : "pointer";
      if (index >= 0) {
        hover.textContent = displayName(atlas.parts[index].name, language.current);
        hover.style.left = `${Math.max(8, Math.min(x + 14, el.clientWidth - 260))}px`;
        hover.style.top = `${Math.max(8, Math.min(y + 18, el.clientHeight - 55))}px`;
      }
    };
    const cancel = (e: PointerEvent) => tap.cancel(e.pointerId);
    const up = (e: PointerEvent) => {
      const validTap = tap.up(e.pointerId, e.clientX, e.clientY);
      if (!validTap || !ready) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        (-(e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      let nearest = Infinity,
        found = -1;
      activeParts.forEach((i) => {
        const mesh = pickers[i];
        if (
          !mesh ||
          data[i * 4 + 3] < 0.5 ||
          (hasSolidParts && atlas.parts[i].system === "integumentary")
        )
          return;
        worldBox.copy(bounds[i]).translate(mesh.position);
        if (!raycaster.ray.intersectBox(worldBox, hitPoint)) return;
        const hits = raycaster.intersectObject(mesh, false);
        if (hits[0] && hits[0].distance < nearest) {
          nearest = hits[0].distance;
          found = i;
        }
      });
      if (found < 0 && amount > 0.45)
        found = findTarget(
          e.clientX - rect.left,
          e.clientY - rect.top,
          e.pointerType === "touch" ? 24 : 16,
        );
      if (found >= 0) {
        hover.hidden = true;
        select.current(atlas.parts[found].id);
      }
    };
    renderer.domElement.addEventListener("pointerdown", down);
    renderer.domElement.addEventListener("pointermove", move);
    renderer.domElement.addEventListener("pointerup", up);
    renderer.domElement.addEventListener("pointercancel", cancel);
    let lastExtent = -1;
    animate = (time) => {
      frame = 0;
      if (disposed) return;
      const dt = lastTime ? Math.min((time - lastTime) / 1000, 0.05) : 1 / 60,
        s = latest.current;
      lastTime = time;
      if (lastSelectionColor !== s.selectionColor) {
        const preset = selectionColorPreset(s.selectionColor);
        selectionColors.color.set(preset.color);
        selectionColors.edge.set(preset.edge);
        contextHighlightMaterial.color.copy(selectionColors.edge);
        lastSelectionColor = s.selectionColor;
        dirty = true;
      }
      const changed =
        lastState?.visible !== s.visible ||
        lastState?.selected !== s.selected ||
        lastState?.isolate !== s.isolate ||
        lastState?.partVisibility !== s.partVisibility ||
        lastState?.hiddenParts !== s.hiddenParts;
      if (changed) {
        if (s.isolate && !lastState?.isolate) {
          surroundingView = { position: camera.position.clone(), target: controls.target.clone(), aspect: camera.aspect };
        }
        cameraTransition = null;
      }
      const moving = Math.abs(amount - s.explode) > 0.0001;
      if (moving) {
        amount = T.MathUtils.damp(amount, s.explode, 8, dt);
        if (Math.abs(amount - s.explode) <= 0.0001) amount = s.explode;
        dirty = true;
      }
      if (changed) {
        selectedKey = s.selected.join(",");
        const visible = new Set(s.visible),
          selection = new Set(s.selected),
          hidden = new Set(s.hiddenParts);
        activeParts = [];
        selectedIndices = [];
        hasSolidParts = false;
        atlas.parts.forEach((p, i) => {
          const selected = selection.has(p.id);
          if (selected) selectedIndices.push(i);
          const shown = isPartVisible(p, visible, selection, s.isolate, hidden, s.partVisibility);
          partVisibility[i] = shown ? 1 : 0;
          data[i * 4 + 3] = shown ? 1 : 0;
          // Isolation already identifies the target; retain its anatomical color.
          selectedData[i * 4] = selected && !s.isolate ? 255 : 0;
          if (shown) {
            activeParts.push(i);
            if (p.system !== "integumentary") hasSolidParts = true;
          }
        });
        const visibleParts = atlas.parts.filter((p) =>
          isPartVisible(p, visible, selection, s.isolate, hidden, s.partVisibility),
        );
        const nextLayoutKey =
          visibleParts.map((p) => p.id).join(",") + ":" + camera.aspect.toFixed(3);
        if (nextLayoutKey !== layoutKey) {
          const layout = createExplosionLayout(visibleParts, camera.aspect);
          systemLayout = createSystemSeparationLayout(visibleParts);
          packingWidth = layout.width;
          packingHeight = layout.height;
          atlas.parts.forEach((p, i) => {
            const cell = layout.cells.get(p.id);
            offsets[i] = cell ? new T.Vector3(cell.x, cell.y + 0.85, 0) : centers[i].clone();
          });
          layoutKey = nextLayoutKey;
          if (amount > 0.05 && !s.isolate) fit(s.view, amount);
        }
        updateDrawBatches(batches, partVisibility);
        if (!shadersReady) batches.forEach(({ mesh }) => { mesh.visible = false; });
        selectionTexture.needsUpdate = true;
      }

      if (changed || moving || lastExtent < 0) {
        let markerCount = 0;
        activeParts.forEach((i) => {
          const c = centers[i],
            destination = offsets[i];
          let dx = 0,
            dy = 0,
            dz = 0;
          const systemOffset = systemLayout.offsets.get(atlas.parts[i].system) ?? 0;
          if (amount <= 0.5) {
            const t = amount / 0.5;
            dx = systemOffset * t;
          } else {
            const t = (amount - 0.5) / 0.5;
            dx = T.MathUtils.lerp(systemOffset, destination.x - c.x, t);
            dy = (destination.y - c.y) * t;
            dz = -c.z * t;
          }
          data[i * 4] = dx;
          data[i * 4 + 1] = dy;
          data[i * 4 + 2] = dz;
          markerPositions[markerCount * 3] = c.x + dx;
          markerPositions[markerCount * 3 + 1] = c.y + dy;
          markerPositions[markerCount * 3 + 2] = c.z + dz;
          markerCount++;
          const mesh = pickers[i];
          if (mesh) {
            mesh.position.set(dx, dy, dz);
            mesh.updateMatrix();
            mesh.updateMatrixWorld(true);
          }
        });
        // Visibility and selection buffers stay cached throughout the animation.
        markerGeometry.setDrawRange(0, markerCount);
        partTexture.needsUpdate = true;
        markerGeometry.attributes.position.needsUpdate = true;
        lastState = s;
        lastExtent = amount;
        dirty = true;
      }
      const viewRequested = lastView !== "" && (s.view !== lastView || s.reset !== lastReset);
      if (s.view !== lastView || s.reset !== lastReset) {
        if (!s.isolate || !s.selected.length) fit(s.view, amount, viewRequested && !moving ? time : undefined);
        lastView = s.view;
        lastReset = s.reset;
      }
      if (moving && !s.isolate)
        fit(amount > 0.5 ? "front" : s.view, amount);
      const selectionFrameKey =
        s.selected.length && (s.isolate || s.focus)
          ? [
              selectedKey,
              s.isolate,
              s.view,
              s.focus,
              s.focusContext,
              s.reset,
              s.inspectorOpen,
              s.inspectorLayout,
              camera.aspect,
            ].join(":")
          : "";
      if (selectionFrameKey !== lastSelectionFrame || (selectionFrameKey && moving)) {
        if (selectionFrameKey) {
          const box = isolationBounds.makeEmpty();
          selectedIndices.forEach((i) => {
            box.union(
              worldBox
                .copy(bounds[i])
                .translate(hitPoint.set(data[i * 4], data[i * 4 + 1], data[i * 4 + 2])),
            );
          });
          if (!box.isEmpty()) {
            let center = box.getCenter(new T.Vector3());
            const size = box.getSize(new T.Vector3());
            const w = el.clientWidth, h = el.clientHeight;
            const sceneRect = el.getBoundingClientRect();
            const margin = Math.min(16, w * 0.04, h * 0.04);
            let left = margin, right = w - margin, top = margin, bottom = h - margin;
            if (s.inspectorOpen) {
              const sheet = document.querySelector(".detail-sheet")?.getBoundingClientRect();
              if (sheet && sheet.left < sceneRect.right && sheet.right > sceneRect.left && sheet.top < sceneRect.bottom && sheet.bottom > sceneRect.top) {
                if (innerWidth < 768) {
                  bottom = T.MathUtils.clamp(sheet.top - sceneRect.top - margin, top + 1, bottom);
                } else {
                  right = T.MathUtils.clamp(sheet.left - sceneRect.left - margin, left + 1, right);
                }
              }
            }
            const availableWidth = Math.max(1, right - left),
              availableHeight = Math.max(1, bottom - top);
            const destinationOffset = new T.Vector2(
              w / 2 - (left + right) / 2,
              h / 2 - (top + bottom) / 2,
            );
            let direction = s.isolate
              ? viewDirection(s.view)
              : camera.position.clone().sub(controls.target).normalize();
            // Fit the bounds in the chosen camera orientation, including their
            // depth, so a long structure also fits when viewed from the side.
            const horizontal = new T.Vector3().crossVectors(camera.up, direction).normalize();
            const vertical = new T.Vector3().crossVectors(direction, horizontal).normalize();
            let frameWidth: number, frameHeight: number, frameDepth: number;
            const projectedSize = (axis: T.Vector3) =>
              Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;
            if (s.isolate) {
              // Frame each part in camera space instead of projecting a combined
              // world-space box, which adds empty space around multipart organs.
              const viewBounds = new T.Box3();
              const corner = new T.Vector3();
              const projectedCorner = new T.Vector3();
              selectedIndices.forEach((i) => {
                const partBounds = bounds[i];
                for (let c = 0; c < 8; c++) {
                  corner.set(
                    (c & 1 ? partBounds.max.x : partBounds.min.x) + data[i * 4],
                    (c & 2 ? partBounds.max.y : partBounds.min.y) + data[i * 4 + 1],
                    (c & 4 ? partBounds.max.z : partBounds.min.z) + data[i * 4 + 2],
                  );
                  projectedCorner.set(corner.dot(horizontal), corner.dot(vertical), corner.dot(direction));
                  viewBounds.expandByPoint(projectedCorner);
                }
              });
              const viewCenter = viewBounds.getCenter(new T.Vector3());
              const viewSize = viewBounds.getSize(new T.Vector3());
              center = horizontal.clone().multiplyScalar(viewCenter.x)
                .addScaledVector(vertical, viewCenter.y).addScaledVector(direction, viewCenter.z);
              frameWidth = viewSize.x;
              frameHeight = viewSize.y;
              frameDepth = viewSize.z;
              // Tiny structures need a closer clipping plane and zoom limit.
              camera.near = T.MathUtils.clamp(viewSize.length() * 0.02, 0.0001, 0.005);
              camera.updateProjectionMatrix();
            } else {
              camera.near = 0.005;
              camera.updateProjectionMatrix();
              frameWidth = projectedSize(horizontal);
              frameHeight = projectedSize(vertical);
              frameDepth = projectedSize(direction);
            }
            let distance = Math.max(
              s.isolate ? camera.near * 2 : 0.07,
              (Math.max(
                (frameHeight * h) / availableHeight,
                (frameWidth * w) / availableWidth / camera.aspect,
              ) /
                (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)))) *
                (s.isolate ? 1.22 : 1.7) + frameDepth / 2,
            );
            if (s.focusContext && s.focus && !s.isolate) {
              // Restore context instead of zooming back into the isolated organ.
              center = surroundingView?.target.clone() ?? new T.Vector3(0, 0.85, 0);
              direction = surroundingView
                ? surroundingView.position.clone().sub(surroundingView.target).normalize()
                : new T.Vector3(0.35, 0.06, 1).normalize();
              distance = Math.max(distance * 2, 1.6,
                surroundingView ? surroundingView.position.distanceTo(surroundingView.target) * Math.max(1, surroundingView.aspect / camera.aspect) : 3.6);
            }
            controls.maxDistance = Math.max(40, distance * 2);
            controls.minDistance = s.isolate
              ? Math.min(distance, Math.max(camera.near * 2, size.length() * 0.15))
              : 0.07;
            const destination = center.clone().addScaledVector(direction, distance);
            const offset = new T.Vector2(camera.view?.enabled ? camera.view.offsetX : 0, camera.view?.enabled ? camera.view.offsetY : 0);
            const alreadyCentered = camera.position.distanceTo(destination) <= distance * 0.001 &&
              controls.target.distanceTo(center) <= distance * 0.001 &&
              offset.distanceTo(destinationOffset) <= 0.5;
            if ((s.focus || viewRequested) && !moving && !reducedMotion.matches && !alreadyCentered) {
              // Clear orbit inertia before capturing a new journey. Repeated
              // locate clicks start from the current pose, not the previous origin.
              controls.enableDamping = false;
              controls.autoRotate = false;
              controls.update();
              controls.enableDamping = true;
              cameraTransition = {
                start: time,
                position: camera.position.clone(),
                target: controls.target.clone(),
                destination,
                center,
                offset,
                destinationOffset,
                orbit: viewRequested,
              };
            } else {
              cameraTransition = null;
              controls.autoRotate = false;
              controls.enableDamping = false;
              controls.update();
              camera.setViewOffset(w, h, destinationOffset.x, destinationOffset.y, w, h);
              controls.target.copy(center);
              camera.position.copy(destination);
              controls.update();
            }
            dirty = true;
          }
        } else if (lastSelectionFrame) {
          fit(s.view, amount, viewRequested && !moving ? time : undefined);
        }
        lastSelectionFrame = selectionFrameKey;
      }
      controls.enableRotate = amount < 0.8;
      controls.mouseButtons.LEFT = amount < 0.8 ? T.MOUSE.ROTATE : T.MOUSE.PAN;
      controls.touches.ONE = amount < 0.8 ? T.TOUCH.ROTATE : T.TOUCH.PAN;
      const baseVisible = s.showBase !== false && amount < 0.5 && !s.isolate;
      if (platform.visible !== baseVisible) dirty = true;
      ground.visible =
        platform.visible =
        ring.visible =
        innerRing.visible =
          baseVisible;
      markers.visible = amount > 0.75;
      const highlightKey = ready && s.focusContext && s.focus && !s.isolate ? selectedKey : "";
      if (highlightKey !== contextHighlightKey) {
        contextHighlight.clear();
        if (highlightKey) selectedIndices.forEach((i) => {
          if (!pickers[i]) return;
          // Only occluded surfaces get this overlay; exposed surfaces retain
          // their normal selection shading. Shared geometry stays cached.
          const mesh = new T.Mesh(pickers[i]!.geometry, contextHighlightMaterial);
          mesh.userData.part = i;
          mesh.renderOrder = 20;
          contextHighlight.add(mesh);
        });
        contextHighlightKey = highlightKey;
        dirty = true;
      }
      contextHighlight.children.forEach((mesh) => {
        const i = mesh.userData.part as number;
        mesh.position.set(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]);
      });
      controls.autoRotate = s.rotate && amount < 0.4;
      controls.autoRotateSpeed = 0.65 * T.MathUtils.clamp(s.rotationSpeed ?? 1, 0.1, 10) *
        (s.rotationDirection === "counterclockwise" ? -1 : 1);
      if (cameraTransition) {
        const journey = cameraTransition;
        const progress = reducedMotion.matches ? 1 : T.MathUtils.clamp((time - journey.start) / 650, 0, 1);
        // Smoothstep eases both ends, including the inspector's framing offset.
        const eased = progress * progress * (3 - 2 * progress);
        controls.target.lerpVectors(journey.target, journey.center, eased);
        if (journey.orbit) {
          // Follow the shortest arc around the structure; a straight line from
          // front to back would pass through its center.
          const from = new T.Spherical().setFromVector3(journey.position.clone().sub(journey.target));
          const to = new T.Spherical().setFromVector3(journey.destination.clone().sub(journey.center));
          const angle = Math.atan2(Math.sin(to.theta - from.theta), Math.cos(to.theta - from.theta));
          const pose = new T.Spherical(
            T.MathUtils.lerp(from.radius, to.radius, eased),
            T.MathUtils.lerp(from.phi, to.phi, eased),
            from.theta + angle * eased,
          );
          camera.position.setFromSpherical(pose).add(controls.target);
        } else {
          camera.position.lerpVectors(journey.position, journey.destination, eased);
        }
        camera.setViewOffset(el.clientWidth, el.clientHeight,
          T.MathUtils.lerp(journey.offset.x, journey.destinationOffset.x, eased),
          T.MathUtils.lerp(journey.offset.y, journey.destinationOffset.y, eased),
          el.clientWidth, el.clientHeight);
        controls.enableDamping = false;
        controls.autoRotate = false;
        dirty = true;
        if (progress === 1) {
          cameraTransition = null;
        }
      }
      // Time-based orbiting keeps the slider's linear speed consistent across
      // displays and rendering loads rather than depending on frame count.
      controls.update(dt);
      controls.enableDamping = true;
      if (controls.autoRotate) dirty = true;
      if (dirty) {
        renderer.render(scene, camera);
        targetsDirty = true;
        dirty = false;
      }
      if (moving || controls.autoRotate || cameraTransition) requestFrame();
      if (!frame) lastTime = 0;
    };
    refreshTargets = () => {
      targetsDirty = false;
      const screenWidth = el.clientWidth,
        screenHeight = el.clientHeight;
      targets = [];
      if (amount > 0.45) {
        activeParts.forEach((i) => {
          const p = atlas.parts[i];
          if (data[i * 4 + 3] < 0.5 || (hasSolidParts && p.system === "integumentary")) return;
          let left = Infinity,
            right = -Infinity,
            top = Infinity,
            bottom = -Infinity;
          for (let corner = 0; corner < 8; corner++) {
            projected
              .set(
                p.bounds[corner & 1 ? 1 : 0][0] + data[i * 4],
                p.bounds[corner & 2 ? 1 : 0][1] + data[i * 4 + 1],
                p.bounds[corner & 4 ? 1 : 0][2] + data[i * 4 + 2],
              )
              .project(camera);
            const x = ((projected.x + 1) * screenWidth) / 2,
              y = ((1 - projected.y) * screenHeight) / 2;
            left = Math.min(left, x);
            right = Math.max(right, x);
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
          projected
            .copy(centers[i])
            .add(hitPoint.set(data[i * 4], data[i * 4 + 1], data[i * 4 + 2]))
            .project(camera);
          if (projected.z < -1 || projected.z > 1) return;
          targets.push({
            index: i,
            x: ((projected.x + 1) * screenWidth) / 2,
            y: ((1 - projected.y) * screenHeight) / 2,
            left,
            right,
            top,
            bottom,
          });
        });
      }
    };
    const visibilityChanged = () => {
      lastTime = 0;
      if (document.hidden) {
        cancelAnimationFrame(frame);
        frame = 0;
      } else {
        dirty = true;
        requestFrame();
      }
    };
    document.addEventListener("visibilitychange", visibilityChanged);
    requestFrame();
    const contextLost = (e: Event) => {
      e.preventDefault();
      contextUnavailable = true;
      abort.abort();
      onError("The 3D session was paused by your device. Reload to continue.");
    };
    renderer.domElement.addEventListener("webglcontextlost", contextLost);
    return () => {
      disposed = true;
      abort.abort();
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", visibilityChanged);
      wake.current = () => {};
      observer.disconnect();
      controls.dispose();
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      scene.traverse((o) => {
        if (o instanceof T.Mesh && !geometries.includes(o.geometry)) {
          o.geometry.dispose();
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          ms.forEach((m) => m.dispose());
        }
      });
      env.dispose();
      partTexture.dispose();
      selectionTexture.dispose();
      markerGeometry.dispose();
      markerMaterial.dispose();
      hover.remove();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [atlas]);
  return <div className="scene" ref={host} />;
}
