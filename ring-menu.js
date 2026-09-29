// Custom radial HUD menu engine. No external dependencies.
//
// Gesture model: two interaction modes, switchable at runtime (see the config
// panel in index.html):
//   - Hold:  press and hold anywhere to arm the menu at the reticle, drag by
//     angle/radius, release to commit and close. Mirrors a VR controller
//     trigger + thumbstick (Gamepad API axes -> angle via atan2, magnitude ->
//     radius), so this state machine is meant to carry over to a real WebXR
//     build largely unchanged.
//   - Click: click to arm the menu, then just move the mouse (no button held)
//     to aim; a click drills into whatever's hovered (or commits a leaf/
//     toggle/option/slider value). Committing an action or dropdown option
//     collapses back to the parent level and stays open; toggling a checkbox
//     stays exactly where it is (so you can flip several in a row); only the
//     dead zone (or Escape) fully closes.
//
// Pushing radius past a ring's outer edge drills into the hovered item's
// children one band further out. Only the ROOT ring spans the full circle;
// every deeper ring (a submenu, a dropdown's options, or a slider's arc gauge)
// fans out over a bounded arc centered on its parent's own angle instead of
// the full 360° — so reaching a child never means sweeping the pointer all
// the way around, just nudging it slightly from the direction you're already
// pointing. Pulling radius back in collapses that level.
//
// Each top-level category can carry a `color` (see menu-data.js) that tints
// its own wedge and cascades down to everything drilled into from it, via a
// `--wedge-accent` custom property set per wedge group — CSS reads
// var(--wedge-accent, var(--accent)) so untinted wedges fall back to the
// default accent. Toggle on/off state overrides this with a fixed
// green/red so boolean state reads the same everywhere regardless of category.
(function () {
  const DEAD_R = 64;
  const RING_WIDTH = 96;
  const RING_GAP = 10;
  const HYSTERESIS = 12;
  const FAN_MIN = 64;    // narrowest a child fan is ever allowed to be (degrees)
  const FAN_MAX = 132;   // widest a child fan is ever allowed to be (degrees) — ~37% of a circle
  const FAN_MAX_WIDE = 200; // rings with 9-10 children (asdf10k Subset/Select/Data) get a wider fan so labels stay legible
  const FAN_STEP = 26;   // desired angular room per child, before min/max clamping
  const SLIDER_SPAN = 130; // slider arc gauges use the same fan language as everything else
  const ICON_WEDGE = 27;
  const ICON_HUB = 28;
  const LIST_WINDOW = 12;    // visible slots for a "list" ring, however long the full list is
  const LIST_RING_WIDTH = 190; // taller band than a normal ring — radial text needs the length
  const LIST_SCROLL_MS = 220;    // autoscroll tick when hovering right at the top/bottom edge
  const LIST_SCROLL_MIN_MS = 40; // autoscroll tick once the mouse is far past the edge
  const LIST_OVERSHOOT_DEG_MAX = 50; // radial mode: degrees past the fan edge for full scroll speed
  const BOX_ROW_H = 32;      // alternate "Box" list style: plain readable rows instead of angled text
  const BOX_WIDTH = 220;
  const BOX_OFFSET_X = 170;  // distance from hub center to the box's left edge
  const BOX_OVERSHOOT_PX_MAX = 200; // box mode: px past the box edge for full scroll speed
  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";

  const deg2rad = (d) => (d * Math.PI) / 180;
  const rad2deg = (r) => (r * 180) / Math.PI;
  const norm360 = (a) => { a %= 360; if (a < 0) a += 360; return a; };
  // Shortest signed angular distance from b to a, range (-180, 180].
  const signedDelta = (a, b) => ((a - b + 540) % 360) - 180;
  const fanSpanFor = (n) => Math.min(n >= 9 ? FAN_MAX_WIDE : FAN_MAX, Math.max(FAN_MIN, n * FAN_STEP));

  function polar(cx, cy, r, angleDeg) {
    const rad = deg2rad(angleDeg - 90);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  }

  // Donut-slice path: flat pie wedge if innerR is ~0, else a true annular sector.
  function annularSectorPath(cx, cy, innerR, outerR, startAngle, endAngle) {
    let span = endAngle - startAngle;
    if (span < 0) span += 360;
    const largeArc = span > 180 ? 1 : 0;
    const oStart = polar(cx, cy, outerR, startAngle);
    const oEnd = polar(cx, cy, outerR, endAngle);
    if (innerR <= 0.5) {
      return ["M", cx, cy, "L", oStart.x, oStart.y, "A", outerR, outerR, 0, largeArc, 1, oEnd.x, oEnd.y, "Z"].join(" ");
    }
    const iEnd = polar(cx, cy, innerR, endAngle);
    const iStart = polar(cx, cy, innerR, startAngle);
    return [
      "M", oStart.x, oStart.y,
      "A", outerR, outerR, 0, largeArc, 1, oEnd.x, oEnd.y,
      "L", iEnd.x, iEnd.y,
      "A", innerR, innerR, 0, largeArc, 0, iStart.x, iStart.y,
      "Z",
    ].join(" ");
  }

  function arcPath(cx, cy, r, startAngle, endAngle) {
    let span = endAngle - startAngle;
    if (span < 0) span += 360;
    const largeArc = span > 180 ? 1 : 0;
    const p0 = polar(cx, cy, r, startAngle);
    const p1 = polar(cx, cy, r, endAngle);
    return ["M", p0.x, p0.y, "A", r, r, 0, largeArc, 1, p1.x, p1.y].join(" ");
  }

  function angleToIndex(angle, n) {
    const slice = 360 / n;
    return Math.floor(norm360(angle + slice / 2) / slice) % n;
  }

  // For a "list" ring's radial text: run the label outward along the wedge's
  // own angle instead of horizontally. Wedges on the left half of the circle
  // are flipped 180° (and anchored/read from the outer edge inward) so the
  // text never renders upside down.
  function radialTextTransform(mid) {
    const normMid = ((mid % 360) + 360) % 360;
    const leftSide = normMid > 180;
    return { rotateDeg: leftSide ? mid + 90 : mid - 90, anchor: leftSide ? "end" : "start", leftSide };
  }

  // A level's angular layout: the root ring always spans the full circle
  // (fanCenter == null); every drilled-into level fans out over a bounded arc
  // centered on the parent wedge's own mid-angle, so children stay reachable
  // by a small nudge rather than a sweep around the whole ring.
  function levelGeometry(n, fanCenter) {
    if (fanCenter == null) {
      const sliceWidth = 360 / n;
      return {
        sliceWidth,
        mid: (i) => i * sliceWidth,
        bounds: (i) => [i * sliceWidth - sliceWidth / 2, i * sliceWidth + sliceWidth / 2],
        indexForAngle: (angle) => angleToIndex(angle, n),
      };
    }
    const span = fanSpanFor(n);
    const sliceWidth = span / n;
    const arcStart = fanCenter - span / 2;
    return {
      sliceWidth,
      mid: (i) => arcStart + sliceWidth * (i + 0.5),
      bounds: (i) => [arcStart + i * sliceWidth, arcStart + (i + 1) * sliceWidth],
      indexForAngle: (angle) => {
        let delta = signedDelta(angle, fanCenter);
        delta = Math.max(-span / 2, Math.min(span / 2, delta));
        let idx = Math.floor((delta + span / 2) / sliceWidth);
        if (idx >= n) idx = n - 1;
        if (idx < 0) idx = 0;
        return idx;
      },
    };
  }

  // Decimals shown for a slider follow its step (0.01 -> 2 decimals), so the
  // fractional settings of the real app (opacities, scales) read correctly.
  function sliderDecimals(item) {
    const step = item.step || 1;
    if (step >= 1) return 0;
    return Math.min(4, Math.ceil(-Math.log10(step)));
  }

  function formatSliderValue(item) {
    if (item.labels) return item.labels[Math.round(item.value) - item.min];
    const d = sliderDecimals(item);
    return Number(item.value).toFixed(d) + (item.unit || "");
  }

  // Categories carry an explicit icon key (into the sprite in index.html);
  // every other item falls back to a generic per-type glyph. Keeps the icon
  // set small, consistent, and easy to tint — the label text is what
  // distinguishes individual settings, not a bespoke icon each.
  function iconKeyFor(item) {
    if (item.icon) return item.icon;
    if (item.type === "option") return null;
    return "type-" + item.type;
  }

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }

  function iconUse(key, cx, cy, size, cls) {
    const use = el("use", { x: cx - size / 2, y: cy - size / 2, width: size, height: size, class: cls });
    use.setAttributeNS(XLINK_NS, "xlink:href", "#icon-" + key);
    use.setAttribute("href", "#icon-" + key);
    return use;
  }

  // SVG text doesn't wrap on its own — split longer labels onto two centered
  // tspans near the middle word boundary so they fit inside a narrow wedge.
  // Both tspans share the same x, so — unlike stacking separate elements at
  // different radii along the wedge's angle — there's no sideways drift on
  // wedges that sit off-vertical.
  function setWrappedLabel(textEl, str, x) {
    textEl.textContent = "";
    const words = str.split(" ");
    if (str.length <= 12 || words.length < 2) {
      const t = el("tspan", { x, dy: "0.35em" });
      t.textContent = str;
      textEl.appendChild(t);
      return;
    }
    let best = 0, bestDiff = Infinity, acc = 0;
    for (let i = 0; i < words.length - 1; i++) {
      acc += words[i].length + 1;
      const diff = Math.abs(acc - str.length / 2);
      if (diff < bestDiff) { bestDiff = diff; best = i; }
    }
    const line1 = words.slice(0, best + 1).join(" ");
    const line2 = words.slice(best + 1).join(" ");
    const t1 = el("tspan", { x, dy: "-0.55em" });
    t1.textContent = line1;
    const t2 = el("tspan", { x, dy: "1.1em" });
    t2.textContent = line2;
    textEl.append(t1, t2);
  }

  // A slider's own wedge always shows its live value (bold) with the label
  // beneath it (dim) — both tspans anchored at the same x/y so they read as
  // one centered block. Returns the value tspan so the caller can keep it in
  // sync while dragging without re-rendering the whole wedge.
  function setSliderWedgeContent(textEl, item, x) {
    textEl.textContent = "";
    const value = el("tspan", { x, dy: "-0.65em", class: "wedge-value" });
    value.textContent = formatSliderValue(item);
    const label = el("tspan", { x, dy: "1.3em", class: "wedge-sublabel" });
    label.textContent = item.label;
    textEl.append(value, label);
    return value;
  }

  class RingMenu {
    constructor(svg, rootGroup, data, callbacks) {
      this.svg = svg;
      this.data = data;
      this.onToast = callbacks.onToast || function () {};
      this.onSettingsChange = callbacks.onSettingsChange || function () {};
      this.levels = [];
      this.hoverIndex = [];
      this.sliderCtx = null;
      this.isOpen = false;
      this.center = { x: 0, y: 0 };
      this.lastPointer = { x: 0, y: 0 };
      this.listBoxMode = false;

      this.root = rootGroup;
      this.levelLayer = el("g", { class: "level-layer" });
      this.root.appendChild(this.levelLayer);

      const defs = el("defs", {});
      const clip = el("clipPath", { id: "hub-clip" });
      clip.appendChild(el("circle", { r: DEAD_R, cx: 0, cy: 0 }));
      defs.appendChild(clip);
      this.svg.appendChild(defs);

      this.hub = el("g", { class: "center-hub-group" });
      this.hubBg = el("circle", { class: "center-hub-bg", r: DEAD_R });
      this.hubImage = el("image", {
        x: -60, y: -56, width: DEAD_R * 2, height: DEAD_R * 2,
        class: "center-hub-image",
        "clip-path": "url(#hub-clip)", preserveAspectRatio: "xMidYMid slice",
      });
      this.hubImage.setAttributeNS(XLINK_NS, "xlink:href", "bigbrain.png");
      this.hubImage.setAttribute("href", "bigbrain.png");
      this.hubCircle = el("circle", { class: "center-hub", r: DEAD_R });
      this.hubIcon = iconUse("type-action", 0, -14, ICON_HUB, "center-icon");
      this.hubLabel = el("text", { class: "center-label", y: 16 });
      this.hub.append(this.hubBg, this.hubImage, this.hubCircle, this.hubIcon, this.hubLabel);
      this.root.appendChild(this.hub);
    }

    ringRadii(depth) {
      const innerR = DEAD_R + depth * (RING_WIDTH + RING_GAP);
      return { innerR, outerR: innerR + RING_WIDTH };
    }

    currentRadius() {
      return Math.hypot(this.lastPointer.x - this.center.x, this.lastPointer.y - this.center.y);
    }

    // A level's actual radii — usually just ringRadii(depth), but a level can
    // override it (sliders and "list" rings both store their own, taller band).
    boundsFor(depth, level) {
      if (level && level.innerR != null) return { innerR: level.innerR, outerR: level.outerR };
      return this.ringRadii(depth);
    }

    setCenterLabel(iconKey, label) {
      if (iconKey) {
        this.hubIcon.style.display = "";
        this.hubIcon.setAttributeNS(XLINK_NS, "xlink:href", "#icon-" + iconKey);
        this.hubIcon.setAttribute("href", "#icon-" + iconKey);
      } else {
        this.hubIcon.style.display = "none";
      }
      this.hubLabel.textContent = label || "";
    }

    positionHub() {
      const { x, y } = this.center;
      this.hub.setAttribute("transform", `translate(${x} ${y})`);
    }

    openAt(cx, cy) {
      this.center = { x: cx, y: cy };
      this.isOpen = true;
      this.levels = [];
      this.hoverIndex = [];
      this.sliderCtx = null;
      this.levelLayer.innerHTML = "";
      this.positionHub();
      this.hubCircle.classList.add("armed");
      this.hub.classList.add("open");
      this.setCenterLabel(null, "");
      this.root.classList.remove("closing");
      this.root.classList.add("opening");
      requestAnimationFrame(() => this.root.classList.remove("opening"));
      this.pushLevel(0, { items: this.data.children, sourceId: "root", fanCenter: null, categoryColor: null });
    }

    close() {
      this.isOpen = false;
      this.hubCircle.classList.remove("armed", "cancel-zone");
      this.hub.classList.remove("open");
      this.root.classList.add("closing");
      const layer = this.levelLayer;
      setTimeout(() => { if (!this.isOpen) layer.innerHTML = ""; }, 200);
    }

    truncateFrom(depth) {
      while (this.levels.length > depth) {
        const lvl = this.levels.pop();
        if (lvl && lvl.scrollTimer) clearInterval(lvl.scrollTimer);
        if (lvl && lvl.groupEl) lvl.groupEl.remove();
      }
      this.hoverIndex.length = Math.min(this.hoverIndex.length, depth);
    }

    pushLevel(depth, level) {
      this.levels[depth] = level;
      this.renderRing(depth, level);
    }

    renderRing(depth, level) {
      const { innerR, outerR } = this.ringRadii(depth);
      const { x: cx, y: cy } = this.center;
      const n = level.items.length;
      const geom = levelGeometry(n, level.fanCenter);
      level.geom = geom;
      const g = el("g", { class: "ring-level", "data-depth": depth });
      const gapDeg = Math.min(3, geom.sliceWidth * 0.1);
      level.wedgeEls = [];
      level.items.forEach((item, i) => {
        const [rawStart, rawEnd] = geom.bounds(i);
        const start = rawStart + gapDeg / 2;
        const end = rawEnd - gapDeg / 2;
        const mid = geom.mid(i);
        const isOption = item.type === "option";
        const isSelectedOption = isOption && item.parentItem.selected === item.id;
        const isToggle = item.type === "toggle";
        const isSlider = item.type === "slider";
        const cls = ["wedge", "type-" + item.type];
        if (isSelectedOption) cls.push("option-selected");
        else if (isOption) cls.push("option-unselected");
        if (isToggle) cls.push(item.value ? "toggle-on" : "toggle-off");

        const wedgeG = el("g", { class: "wedge-group" });
        const color = depth === 0 ? item.color : level.categoryColor;
        if (color) wedgeG.style.setProperty("--wedge-accent", color);

        const path = el("path", {
          d: annularSectorPath(cx, cy, innerR, outerR, start, end),
          class: cls.join(" "),
        });
        wedgeG.appendChild(path);

        const iconKey = iconKeyFor(item);
        let icon = null;
        if (iconKey) {
          const cornerNudge = Math.min(geom.sliceWidth * 0.28, 14);
          const cornerPos = polar(cx, cy, outerR - 19, mid + cornerNudge);
          icon = iconUse(iconKey, cornerPos.x, cornerPos.y, ICON_WEDGE, "wedge-icon");
          wedgeG.appendChild(icon);
        }

        // Slider content sits slightly inward, leaving the outer rim free for
        // its own mini progress-bar arc (below) — the same arc that grows into
        // the full draggable gauge once you push out past the wedge's edge.
        const contentFrac = isSlider ? 0.4 : 0.5;
        const mainPos = polar(cx, cy, innerR + (outerR - innerR) * contentFrac, mid);
        const label = el("text", { x: mainPos.x, y: mainPos.y, class: "wedge-label" });
        let valueTspan = null;
        if (isSlider) valueTspan = setSliderWedgeContent(label, item, mainPos.x);
        else setWrappedLabel(label, item.label, mainPos.x);
        wedgeG.appendChild(label);

        let barFill = null;
        let barMeta = null;
        if (isSlider) {
          const barR = outerR - 7;
          const barInset = (end - start) * 0.14;
          const barStart = start + barInset;
          const barEnd = end - barInset;
          const frac = (item.value - item.min) / (item.max - item.min);
          const barTrack = el("path", { d: arcPath(cx, cy, barR, barStart, barEnd), class: "wedge-slider-track" });
          const barFillEl = el("path", { d: arcPath(cx, cy, barR, barStart, barStart + (barEnd - barStart) * frac), class: "wedge-slider-fill" });
          wedgeG.append(barTrack, barFillEl);
          barFill = barFillEl;
          barMeta = { barR, start: barStart, end: barEnd };
        }

        g.appendChild(wedgeG);
        level.wedgeEls.push({ path, icon, label, valueTspan, barFill, barMeta });
      });
      this.levelLayer.appendChild(g);
      level.groupEl = g;
    }

    ensureChildRing(depth, item, kind, fanCenter) {
      const existing = this.levels[depth + 1];
      if (existing && existing.sourceId === item.id && existing.kind === kind) return;
      this.truncateFrom(depth + 1);
      const items = kind === "options"
        ? item.options.map((o) => Object.assign({ type: "option", parentItem: item }, o))
        : item.children;
      const categoryColor = item.color || (this.levels[depth] && this.levels[depth].categoryColor) || null;
      this.pushLevel(depth + 1, { items, sourceId: item.id, kind, fanCenter, categoryColor, entryRadius: this.currentRadius() });
    }

    // A "list" ring: a long alphabetical word list, only LIST_WINDOW slots
    // shown at once with an angular scrollbar arc along the outer edge —
    // hovering the top/bottom slot autoscrolls the rest into view.
    ensureListRing(depth, item, fanCenter) {
      const existing = this.levels[depth + 1];
      if (existing && existing.sourceId === item.id && existing.kind === "list") return;
      this.truncateFrom(depth + 1);
      const allItems = item.words.map((w, i) => ({ id: item.id + "_" + i, label: w, type: "action" }));
      const { innerR } = this.ringRadii(depth + 1);
      const outerR = innerR + LIST_RING_WIDTH;
      const categoryColor = item.color || (this.levels[depth] && this.levels[depth].categoryColor) || null;
      const level = {
        sourceId: item.id, kind: "list", fanCenter, categoryColor, depth: depth + 1,
        allItems, scrollOffset: 0, items: allItems.slice(0, LIST_WINDOW),
        innerR, outerR, scrollTimer: null, entryRadius: this.currentRadius(),
        boxMode: this.listBoxMode,
      };
      this.levels[depth + 1] = level;
      this.renderListRing(depth + 1, level);
    }

    renderListRing(depth, level) {
      if (level.boxMode) { this.renderListBox(depth, level); return; }
      this.renderListRadial(depth, level);
    }

    renderListRadial(depth, level) {
      const { innerR, outerR } = level;
      const { x: cx, y: cy } = this.center;
      const n = LIST_WINDOW;
      const geom = levelGeometry(n, level.fanCenter);
      level.geom = geom;
      if (level.groupEl) level.groupEl.remove();
      const g = el("g", { class: "ring-level list-level", "data-depth": depth });
      const gapDeg = Math.min(1.4, geom.sliceWidth * 0.12);
      level.wedgeEls = [];
      level.items.forEach((item, i) => {
        const [rawStart, rawEnd] = geom.bounds(i);
        const start = rawStart + gapDeg / 2;
        const end = rawEnd - gapDeg / 2;
        const mid = geom.mid(i);

        const wedgeG = el("g", { class: "wedge-group" });
        if (level.categoryColor) wedgeG.style.setProperty("--wedge-accent", level.categoryColor);
        const path = el("path", {
          d: annularSectorPath(cx, cy, innerR, outerR, start, end),
          class: "wedge type-action list-item",
        });
        wedgeG.appendChild(path);

        const { rotateDeg, anchor, leftSide } = radialTextTransform(mid);
        const pad = 12;
        const textR = leftSide ? outerR - pad : innerR + pad;
        const pos = polar(cx, cy, textR, mid);
        const label = el("text", {
          x: pos.x, y: pos.y, class: "list-label", "text-anchor": anchor,
          transform: `rotate(${rotateDeg} ${pos.x} ${pos.y})`,
        });
        label.textContent = item.label;
        wedgeG.appendChild(label);

        g.appendChild(wedgeG);
        level.wedgeEls.push({ path, label });
      });

      // Angular scrollbar: a track spanning the whole fan, with a thumb sized
      // to the visible fraction (12 of N) positioned by scroll offset.
      const total = level.allItems.length;
      const [fullStart] = geom.bounds(0);
      const [, fullEnd] = geom.bounds(n - 1);
      const scrollR = outerR + 13;
      const track = el("path", { d: arcPath(cx, cy, scrollR, fullStart, fullEnd), class: "list-scroll-track" });
      g.appendChild(track);
      if (total > n) {
        const trackSpan = fullEnd - fullStart;
        const thumbSpan = trackSpan * (n / total);
        // thumbStart ranges over [fullStart, fullEnd - thumbSpan] — not the full
        // track — so the thumb's own width never carries it past the track's end.
        const thumbStart = fullStart + (trackSpan - thumbSpan) * (level.scrollOffset / (total - n));
        const thumb = el("path", { d: arcPath(cx, cy, scrollR, thumbStart, thumbStart + thumbSpan), class: "list-scroll-thumb" });
        g.appendChild(thumb);
      }

      this.levelLayer.appendChild(g);
      level.groupEl = g;
    }

    // Alternate "Box" list style: a plain readable rectangular list beside the
    // ring instead of angled radial text, with a funnel shape back to where it
    // opened from. Row hit-testing is plain vertical position, not angle —
    // see the level.boxMode branch in updateGesture().
    renderListBox(depth, level) {
      const { x: cx, y: cy } = this.center;
      const rowH = BOX_ROW_H;
      const boxW = BOX_WIDTH;
      const n = level.items.length;
      const boxLeft = cx + BOX_OFFSET_X;
      const boxTop = cy - (n * rowH) / 2;
      level.boxLeft = boxLeft;
      level.boxTop = boxTop;
      level.boxW = boxW;
      level.rowH = rowH;

      if (level.groupEl) level.groupEl.remove();
      const g = el("g", { class: "ring-level list-box-level", "data-depth": depth });
      if (level.categoryColor) g.style.setProperty("--wedge-accent", level.categoryColor);

      // A funnel from the wedge's own edge point fanning out to the box's
      // full height — reads as "this box's contents came from here" instead
      // of a thin line pointing at one spot.
      const originPt = polar(cx, cy, level.innerR, level.fanCenter);
      const topPt = { x: boxLeft, y: boxTop };
      const botPt = { x: boxLeft, y: boxTop + n * rowH };
      const funnelFill = el("path", {
        d: `M ${originPt.x} ${originPt.y} L ${topPt.x} ${topPt.y} L ${botPt.x} ${botPt.y} Z`,
        class: "list-box-funnel-fill",
      });
      const funnelOutline = el("path", {
        d: `M ${topPt.x} ${topPt.y} L ${originPt.x} ${originPt.y} L ${botPt.x} ${botPt.y}`,
        class: "list-box-funnel-outline",
      });
      g.append(funnelFill, funnelOutline);

      const boxBg = el("rect", { x: boxLeft, y: boxTop, width: boxW, height: n * rowH, rx: 8, class: "list-box-bg" });
      g.appendChild(boxBg);

      level.wedgeEls = [];
      level.items.forEach((item, i) => {
        const rowY = boxTop + i * rowH;
        const wedgeG = el("g", { class: "wedge-group" });
        if (level.categoryColor) wedgeG.style.setProperty("--wedge-accent", level.categoryColor);
        const row = el("rect", { x: boxLeft, y: rowY, width: boxW, height: rowH, class: "wedge type-action list-box-row" });
        wedgeG.appendChild(row);
        const label = el("text", { x: boxLeft + 14, y: rowY + rowH / 2, class: "list-box-label" });
        label.textContent = item.label;
        wedgeG.appendChild(label);
        g.appendChild(wedgeG);
        level.wedgeEls.push({ path: row, label });
      });

      const total = level.allItems.length;
      if (total > n) {
        const trackH = n * rowH;
        const trackX = boxLeft + boxW + 8;
        const track = el("rect", { x: trackX, y: boxTop, width: 4, height: trackH, rx: 2, class: "list-box-scroll-track" });
        g.appendChild(track);
        const thumbH = trackH * (n / total);
        const thumbY = boxTop + (trackH - thumbH) * (level.scrollOffset / (total - n));
        const thumb = el("rect", { x: trackX, y: thumbY, width: 4, height: thumbH, rx: 2, class: "list-box-scroll-thumb" });
        g.appendChild(thumb);
      }

      this.levelLayer.appendChild(g);
      level.groupEl = g;
    }

    boxListIndexAt(level, px, py) {
      let idx = Math.floor((py - level.boxTop) / level.rowH);
      if (idx < 0) idx = 0;
      if (idx >= level.items.length) idx = level.items.length - 1;
      return idx;
    }

    // How far (px) the pointer is past the box's own top/bottom edge — 0 while
    // still inside it. Used to make autoscroll speed up the further you go.
    boxListOvershoot(level, py) {
      if (py < level.boxTop) return level.boxTop - py;
      const boxBottom = level.boxTop + level.items.length * level.rowH;
      if (py > boxBottom) return py - boxBottom;
      return 0;
    }

    stopListScroll(level) {
      if (level.scrollTimer) { clearTimeout(level.scrollTimer); level.scrollTimer = null; }
    }

    scrollList(level, dir) {
      const total = level.allItems.length;
      const maxOffset = total - LIST_WINDOW;
      const next = Math.max(0, Math.min(maxOffset, level.scrollOffset + dir));
      if (next === level.scrollOffset) { this.stopListScroll(level); return; }
      level.scrollOffset = next;
      level.items = level.allItems.slice(next, next + LIST_WINDOW);
      const hoveredIdx = this.hoverIndex[level.depth];
      this.renderListRing(level.depth, level);
      if (hoveredIdx != null && level.wedgeEls[hoveredIdx]) level.wedgeEls[hoveredIdx].path.classList.add("hovered");
    }

    // speedFraction: 0 (right at the edge) .. 1 (far past it) — the further
    // the pointer is beyond the top/bottom row, the faster it autoscrolls.
    // Uses a self-rescheduling setTimeout (not setInterval) so the delay can
    // be recomputed every tick as the fraction changes.
    updateListScrollTimer(level, idx, speedFraction) {
      const total = level.allItems.length;
      const wantsUp = idx === 0 && level.scrollOffset > 0;
      const wantsDown = idx === LIST_WINDOW - 1 && level.scrollOffset < total - LIST_WINDOW;
      if (!wantsUp && !wantsDown) { this.stopListScroll(level); return; }
      level.scrollDir = wantsUp ? -1 : 1;
      level.scrollSpeedFraction = speedFraction || 0;
      if (level.scrollTimer) return;
      const scheduleNext = () => {
        const frac = Math.max(0, Math.min(1, level.scrollSpeedFraction));
        const delay = LIST_SCROLL_MS - frac * (LIST_SCROLL_MS - LIST_SCROLL_MIN_MS);
        level.scrollTimer = setTimeout(tick, delay);
      };
      const tick = () => {
        this.scrollList(level, level.scrollDir);
        if (level.scrollTimer != null) scheduleNext();
      };
      scheduleNext();
    }

    enterSlider(depth, item, fanCenter, idx) {
      if (this.sliderCtx && this.sliderCtx.item === item) return;
      this.truncateFrom(depth + 1);
      const { innerR, outerR } = this.ringRadii(depth + 1);
      const { x: cx, y: cy } = this.center;
      const span = SLIDER_SPAN;
      const categoryColor = (this.levels[depth] && this.levels[depth].categoryColor) || item.color || null;
      const g = el("g", { class: "ring-level slider-level", "data-depth": depth + 1 });
      if (categoryColor) g.style.setProperty("--wedge-accent", categoryColor);
      const track = el("path", { d: arcPath(cx, cy, (innerR + outerR) / 2, fanCenter - span / 2, fanCenter + span / 2), class: "slider-track" });
      const fill = el("path", { class: "slider-fill" });
      const handle = el("circle", { r: 11, class: "slider-handle" });
      const readout = el("text", { class: "slider-readout" });
      const caption = el("text", { class: "slider-caption" });
      const captionPos = polar(cx, cy, outerR + 18, fanCenter);
      caption.setAttribute("x", captionPos.x);
      caption.setAttribute("y", captionPos.y);
      caption.textContent = item.label;
      g.append(track, fill, handle, readout, caption);
      this.levelLayer.appendChild(g);
      const level = { items: [item], sourceId: item.id, kind: "slider", groupEl: g, innerR, outerR };
      this.levels[depth + 1] = level;
      const parentWedge = this.levels[depth] && this.levels[depth].wedgeEls[idx];
      const parentBar = parentWedge && parentWedge.barFill ? Object.assign({ el: parentWedge.barFill }, parentWedge.barMeta) : null;
      this.sliderCtx = { depth: depth + 1, item, level, fill, handle, readout, fanCenter, span, parentValueTspan: parentWedge && parentWedge.valueTspan, parentBar, entryRadius: this.currentRadius() };
      this.renderSliderValue();
    }

    renderSliderValue() {
      const { item, level, fill, handle, readout, fanCenter, span, parentValueTspan, parentBar } = this.sliderCtx;
      const { x: cx, y: cy } = this.center;
      const midR = (level.innerR + level.outerR) / 2;
      const frac = (item.value - item.min) / (item.max - item.min);
      const angle = fanCenter - span / 2 + frac * span;
      fill.setAttribute("d", arcPath(cx, cy, midR, fanCenter - span / 2, angle));
      const hp = polar(cx, cy, midR, angle);
      handle.setAttribute("cx", hp.x);
      handle.setAttribute("cy", hp.y);
      readout.setAttribute("x", hp.x);
      readout.setAttribute("y", hp.y - 24);
      readout.textContent = formatSliderValue(item);
      if (parentValueTspan) parentValueTspan.textContent = formatSliderValue(item);
      if (parentBar) parentBar.el.setAttribute("d", arcPath(cx, cy, parentBar.barR, parentBar.start, parentBar.start + (parentBar.end - parentBar.start) * frac));
    }

    updateSliderFromAngle(angle) {
      const { item, fanCenter, span } = this.sliderCtx;
      const delta = Math.max(-span / 2, Math.min(span / 2, signedDelta(angle, fanCenter)));
      const frac = (delta + span / 2) / span;
      const raw = item.min + frac * (item.max - item.min);
      const d = sliderDecimals(item);
      const stepped = Number((Math.round(raw / item.step) * item.step).toFixed(d));
      const clamped = Math.max(item.min, Math.min(item.max, stepped));
      if (clamped !== item.value) {
        item.value = clamped;
        this.renderSliderValue();
        this.onSettingsChange(item);
      }
    }

    exitSlider() {
      this.truncateFrom(this.sliderCtx.depth);
      this.sliderCtx = null;
    }

    setHover(depth, idx, scrollSpeedFraction) {
      const level = this.levels[depth];
      if (this.hoverIndex[depth] === idx) {
        // idx unchanged, but for a list at the edge the pointer may have moved
        // further past it — keep the autoscroll speed live either way.
        if (level.kind === "list") this.updateListScrollTimer(level, idx, scrollSpeedFraction);
        return;
      }
      const prev = this.hoverIndex[depth];
      if (prev != null && level.wedgeEls[prev]) level.wedgeEls[prev].path.classList.remove("hovered");
      if (level.wedgeEls[idx]) level.wedgeEls[idx].path.classList.add("hovered");
      this.hoverIndex[depth] = idx;
      if (level.kind === "list") this.updateListScrollTimer(level, idx, scrollSpeedFraction);
      this.flashHubImage();
    }

    // Briefly swap the center hub image to bigbrain2.png whenever the hovered
    // menu item changes (including a new level opening up), then revert.
    flashHubImage() {
      if (!this.hubImage) return;
      this.hubImage.setAttributeNS(XLINK_NS, "xlink:href", "bigbrain2.png");
      this.hubImage.setAttribute("href", "bigbrain2.png");
      clearTimeout(this._hubFlashTimer);
      this._hubFlashTimer = setTimeout(() => {
        this.hubImage.setAttributeNS(XLINK_NS, "xlink:href", "bigbrain.png");
        this.hubImage.setAttribute("href", "bigbrain.png");
      }, 100);
    }

    clearHover(depth) {
      const level = this.levels[depth];
      const prev = this.hoverIndex[depth];
      if (level && prev != null && level.wedgeEls[prev]) level.wedgeEls[prev].path.classList.remove("hovered");
      this.hoverIndex[depth] = null;
    }

    refreshToggleWedge(level, idx, item) {
      const w = level.wedgeEls[idx];
      if (!w) return;
      w.path.classList.toggle("toggle-on", item.value);
      w.path.classList.toggle("toggle-off", !item.value);
    }

    // Re-applies selected/unselected classes to every wedge in an options fan
    // after picking a new one — the fan itself stays open the whole time.
    refreshOptionsFan(level) {
      level.items.forEach((opt, i) => {
        const w = level.wedgeEls[i];
        if (!w) return;
        const isSelected = opt.parentItem.selected === opt.id;
        w.path.classList.toggle("option-selected", isSelected);
        w.path.classList.toggle("option-unselected", !isSelected);
      });
    }

    // The center hub stays static (its icon/label are set once in openAt() and
    // left alone) — only its dead-zone/cancel-zone stroke reacts as you hover,
    // since the wedges themselves already show what's selected. Used after a
    // click-mode commit collapses a level, and during normal hover.
    refreshLabelFromState() {
      let hovering = false;
      for (let d = 0; d < this.levels.length; d++) {
        if (this.hoverIndex[d] == null) break;
        hovering = true;
      }
      this.hubCircle.classList.toggle("cancel-zone", !hovering);
    }

    updateGesture(px, py) {
      if (!this.isOpen) return;
      this.lastPointer = { x: px, y: py };
      const dx = px - this.center.x;
      const dy = py - this.center.y;
      const radius = Math.hypot(dx, dy);
      const angle = norm360(rad2deg(Math.atan2(dy, dx)) + 90);

      if (this.sliderCtx) {
        const sliderFloor = Math.min(this.sliderCtx.entryRadius, this.sliderCtx.level.innerR) - HYSTERESIS;
        if (radius < sliderFloor) {
          this.exitSlider();
        } else {
          this.updateSliderFromAngle(angle);
          this.hubCircle.classList.remove("cancel-zone");
          return;
        }
      }

      let depth = 0;
      while (true) {
        const level = this.levels[depth];
        if (!level) break;
        const bounds = this.boundsFor(depth, level);
        const { outerR } = bounds;
        // A level force-advanced into by a click (rather than dragged past its
        // edge) may have been entered from a radius lower than its own innerR
        // — e.g. clicking a slider/list while it was still just being
        // previewed in its parent's band. Floor on whichever is lower so the
        // very next pointer move doesn't read as "retreated past the edge"
        // and collapse the level you just deliberately opened.
        const floor = depth === 0 ? DEAD_R : Math.min(level.entryRadius != null ? level.entryRadius : bounds.innerR, bounds.innerR) - HYSTERESIS;
        if (radius < floor) {
          this.clearHover(depth);
          this.truncateFrom(depth === 0 ? 1 : depth);
          break;
        }
        if (level.kind === "list" && level.boxMode) {
          // Box-style lists hit-test by plain vertical position, not angle —
          // and every row is a terminal action, so there's nothing deeper to
          // walk into afterward.
          const boxIdx = this.boxListIndexAt(level, this.lastPointer.x, this.lastPointer.y);
          const overshootPx = this.boxListOvershoot(level, this.lastPointer.y);
          this.setHover(depth, boxIdx, overshootPx / BOX_OVERSHOOT_PX_MAX);
          break;
        }
        // A ring already pushed-past (radius beyond its own outer edge) freezes its
        // selection instead of re-tracking raw angle — otherwise rotating toward a
        // deeper item would flip the parent's own hover to whatever sibling that
        // angle now points at, destroying the child ring you were navigating. Only
        // the deepest live band (radius still within this ring) reads the live angle.
        const idx = radius < outerR
          ? level.geom.indexForAngle(angle)
          : (this.hoverIndex[depth] != null ? this.hoverIndex[depth] : level.geom.indexForAngle(angle));
        let listSpeedFraction = 0;
        if (level.kind === "list") {
          const rawDelta = Math.abs(signedDelta(angle, level.fanCenter));
          const span = fanSpanFor(level.items.length);
          const overshootDeg = Math.max(0, rawDelta - span / 2);
          listSpeedFraction = overshootDeg / LIST_OVERSHOOT_DEG_MAX;
        }
        this.setHover(depth, idx, listSpeedFraction);
        const item = level.items[idx];

        if (this.levels[depth + 1] && this.levels[depth + 1].sourceId !== item.id) {
          this.truncateFrom(depth + 1);
        }

        const fanCenter = level.geom.mid(idx);
        if (radius >= outerR) {
          // Pushed past the parent's own edge: commit to it as the live, navigable level.
          if (item.type === "submenu") { this.ensureChildRing(depth, item, "children", fanCenter); depth++; continue; }
          if (item.type === "dropdown") { this.ensureChildRing(depth, item, "options", fanCenter); depth++; continue; }
          if (item.type === "list") { this.ensureListRing(depth, item, fanCenter); depth++; continue; }
          if (item.type === "slider") { this.enterSlider(depth, item, fanCenter, idx); this.updateSliderFromAngle(angle); break; }
          this.truncateFrom(depth + 1);
          break;
        } else {
          // Just hovering the parent: preview its children immediately rather than
          // waiting for the push-out gesture. Sliders already show their live value
          // directly in their own wedge, so there's nothing extra to preview.
          if (item.type === "submenu") this.ensureChildRing(depth, item, "children", fanCenter);
          else if (item.type === "dropdown") this.ensureChildRing(depth, item, "options", fanCenter);
          else if (item.type === "list") this.ensureListRing(depth, item, fanCenter);
          else this.truncateFrom(depth + 1);
          break;
        }
      }

      if (this.sliderCtx) return;
      this.refreshLabelFromState();
    }

    // Shared commit logic for both interaction modes.
    // collapseInsteadOfClose = false (Hold mode): always fully closes.
    // collapseInsteadOfClose = true  (Click mode): committing an action/option/
    //   slider value pops back to the parent level and stays open; flipping a
    //   toggle stays exactly where it is (so several checkboxes in the same
    //   fan can be flipped in a row); clicking a not-yet-drilled submenu/
    //   dropdown/slider force-advances into it. Only the dead zone closes.
    // Returns true if the menu is still open afterward.
    commitDeepest(collapseInsteadOfClose) {
      if (this.sliderCtx) {
        const { item } = this.sliderCtx;
        this.onToast(`${item.label} set to ${formatSliderValue(item)}`);
        if (!collapseInsteadOfClose) { this.close(); return false; }
        this.exitSlider();
        this.refreshLabelFromState();
        return true;
      }

      // The deepest level with an actual hover, not just levels.length - 1 — a
      // level can exist purely as a preview (shown on hover) without ever
      // having had setHover() called on it.
      let depth = -1;
      for (let d = 0; d < this.levels.length; d++) {
        if (this.hoverIndex[d] == null) break;
        depth = d;
      }
      const idx = depth >= 0 ? this.hoverIndex[depth] : null;
      if (depth < 0 || idx == null) {
        this.onToast("Cancelled", true);
        this.close();
        return false;
      }
      const level = this.levels[depth];
      const item = level.items[idx];

      if (item.type === "toggle") {
        item.value = !item.value;
        this.onToast(`${item.label}: ${item.value ? "On" : "Off"}`);
        this.onSettingsChange(item);
        this.refreshToggleWedge(level, idx, item);
        if (!collapseInsteadOfClose) { this.close(); return false; }
        return true;
      }

      if (item.type === "option") {
        item.parentItem.selected = item.id;
        this.onToast(`${item.parentItem.label} → ${item.label}`);
        this.onSettingsChange(item.parentItem);
        this.refreshOptionsFan(level);
        if (!collapseInsteadOfClose) { this.close(); return false; }
        return true;
      }

      if (item.type === "action") {
        this.onToast(`Selected: ${item.label}`);
        if (!collapseInsteadOfClose) { this.close(); return false; }
        this.truncateFrom(depth === 0 ? 1 : depth);
        this.refreshLabelFromState();
        return true;
      }

      if (!collapseInsteadOfClose) {
        this.onToast("Cancelled", true);
        this.close();
        return false;
      }
      // Submenu / dropdown / slider hovered but not yet drilled into: a click
      // force-advances into it, same as pushing radius past the edge.
      const fanCenter = level.geom.mid(idx);
      if (item.type === "submenu") { this.ensureChildRing(depth, item, "children", fanCenter); this.setHover(depth + 1, 0); }
      else if (item.type === "dropdown") { this.ensureChildRing(depth, item, "options", fanCenter); this.setHover(depth + 1, 0); }
      else if (item.type === "list") { this.ensureListRing(depth, item, fanCenter); this.setHover(depth + 1, 0); }
      else if (item.type === "slider") { this.enterSlider(depth, item, fanCenter, idx); }
      this.refreshLabelFromState();
      return true;
    }

    release() {
      if (this.isOpen) this.commitDeepest(false);
    }

    commitClick() {
      if (!this.isOpen) return true;
      return this.commitDeepest(true);
    }
  }

  function findItemById(node, id) {
    if (!node.children) return null;
    for (const c of node.children) {
      if (c.id === id) return c;
      const found = findItemById(c, id);
      if (found) return found;
    }
    return null;
  }

  function initApp() {
    const stage = document.getElementById("stage");
    const svg = document.getElementById("ring-svg");
    const rootGroup = document.getElementById("ring-root");
    const toastEl = document.getElementById("toast");
    const statePanel = document.getElementById("state-panel-body");
    const hint = document.getElementById("hint");
    const modeToggle = document.getElementById("mode-toggle");
    const modeHint = document.getElementById("mode-hint");
    const listStyleToggle = document.getElementById("list-style-toggle");

    let toastTimer = null;
    function showToast(msg, isCancel) {
      toastEl.textContent = msg;
      toastEl.classList.toggle("cancel", !!isCancel);
      toastEl.classList.remove("show");
      void toastEl.offsetWidth;
      toastEl.classList.add("show");
      clearTimeout(toastTimer);
      toastTimer = setTimeout(() => toastEl.classList.remove("show"), 1700);
    }

    // Representative asdf10k settings shown in the "live settings state" panel (ids from menu-data.js).
    const PANEL_IDS = ["interaction_mode", "node_layout", "edge_cutoff", "edge_opacity", "hl_fade_others", "bloom_mode", "nav_mode", "dataset", "subset_isolate", "resolution_scale"];
    function renderState() {
      const fmt = (i) => {
        if (i.type === "slider") return formatSliderValue(i);
        if (i.type === "dropdown") return i.options.find((o) => o.id === i.selected).label;
        if (i.type === "toggle") return i.value ? "On" : "Off";
        return "";
      };
      statePanel.innerHTML = PANEL_IDS
        .map((id) => findItemById(RING_MENU_DATA, id))
        .filter((item) => item)
        .map((item) => `<div class="row"><span>${item.label}</span><span>${fmt(item)}</span></div>`)
        .join("");
    }
    renderState();

    const menu = new RingMenu(svg, rootGroup, RING_MENU_DATA, {
      onToast: showToast,
      onSettingsChange: renderState,
    });

    // --- Interaction mode: Hold (press+drag+release) vs Click (click to
    // drill/commit, stays open until the dead zone or Escape) -------------
    let holdMode = true;
    try { holdMode = localStorage.getItem("ringhud-hold-mode") !== "0"; } catch (e) {}
    let menuOpen = false;

    try { menu.listBoxMode = localStorage.getItem("ringhud-list-box-mode") === "1"; } catch (e) {}
    listStyleToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.style === (menu.listBoxMode ? "box" : "radial")));
    listStyleToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-style]");
      if (!btn) return;
      menu.listBoxMode = btn.dataset.style === "box";
      try { localStorage.setItem("ringhud-list-box-mode", menu.listBoxMode ? "1" : "0"); } catch (err) {}
      listStyleToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === btn));
    });

    function centerPoint() {
      const r = stage.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    }
    function openMenu() {
      menuOpen = true;
      const c = centerPoint();
      menu.openAt(c.x, c.y);
      hint.classList.add("hidden");
    }
    function closeMenu() {
      menuOpen = false;
      hint.classList.remove("hidden");
    }

    function holdPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      stage.setPointerCapture(e.pointerId);
      if (!menuOpen) openMenu();
      menu.updateGesture(e.clientX, e.clientY);
    }
    function holdPointerMove(e) { if (menuOpen) menu.updateGesture(e.clientX, e.clientY); }
    function holdPointerUp() {
      if (!menuOpen) return;
      menu.release();
      closeMenu();
    }

    function clickPointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (!menuOpen) { openMenu(); menu.updateGesture(e.clientX, e.clientY); return; }
      const stillOpen = menu.commitClick();
      if (!stillOpen) closeMenu();
    }
    function clickPointerMove(e) { if (menuOpen) menu.updateGesture(e.clientX, e.clientY); }

    let attached = null;
    function applyMode() {
      if (attached) {
        stage.removeEventListener("pointerdown", attached.down);
        stage.removeEventListener("pointermove", attached.move);
        if (attached.up) stage.removeEventListener("pointerup", attached.up);
        if (attached.cancel) stage.removeEventListener("pointercancel", attached.cancel);
      }
      if (menuOpen) { menu.close(); closeMenu(); }
      attached = holdMode
        ? { down: holdPointerDown, move: holdPointerMove, up: holdPointerUp, cancel: holdPointerUp }
        : { down: clickPointerDown, move: clickPointerMove, up: null, cancel: null };
      stage.addEventListener("pointerdown", attached.down);
      stage.addEventListener("pointermove", attached.move);
      if (attached.up) stage.addEventListener("pointerup", attached.up);
      if (attached.cancel) stage.addEventListener("pointercancel", attached.cancel);

      modeToggle.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b.dataset.mode === (holdMode ? "hold" : "click")));
      hint.innerHTML = holdMode
        ? "Hold <strong>Mouse</strong> or <strong>Space</strong> to open the ring"
        : "<strong>Click</strong> to open the ring";
      modeHint.textContent = holdMode
        ? "Press and hold, drag by angle, release to commit and close."
        : "Click to open, move the mouse to aim, click to drill in or commit. Click the center or press Esc to close.";
    }

    modeToggle.addEventListener("click", (e) => {
      const btn = e.target.closest("button[data-mode]");
      if (!btn) return;
      holdMode = btn.dataset.mode === "hold";
      try { localStorage.setItem("ringhud-hold-mode", holdMode ? "1" : "0"); } catch (err) {}
      applyMode();
    });

    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !e.repeat && holdMode) { e.preventDefault(); if (!menuOpen) openMenu(); }
      if (e.code === "Escape" && menuOpen) { menu.close(); closeMenu(); }
    });
    window.addEventListener("keyup", (e) => {
      if (e.code === "Space" && holdMode) { e.preventDefault(); holdPointerUp(); }
    });

    applyMode();
  }

  document.addEventListener("DOMContentLoaded", initApp);
})();
