/**
 * CogniGuide: Custom Mind Map Renderer
 *
 * This module handles parsing custom markdown, laying out the node tree, rendering the mind map
 * with SVG connectors, and managing user interactions like panning, zooming, and
 * node collapsing/expanding with animations.
 */

// ============== TYPE DEFINITIONS ==============

export interface MindMapNode {
    id: string;
    text: string;
    html: string;
    children: MindMapNode[];
    level: number;
    isRoot?: boolean;
    isCollapsed?: boolean;
    isExpanding?: boolean;
    isAnimating?: boolean;
    parent: MindMapNode | null;
    themeColor: string | null;
    textColor?: string | null;
    // Properties calculated during layout
    width: number;
    height: number;
    x: number;
    y: number;
    // Properties for animation
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
    animX?: number;
    animY?: number;
    connectorPath?: SVGPathElement;
}

export interface AutoFitCenterBiasOptions {
    x?: number;
    y?: number;
}

export interface InitializeOptions {
    initialPanXOffset?: number;
    initialPanYOffset?: number;
    disableInteractions?: boolean;
    /**
     * Controls what interactions are allowed on the rendered map.
     * - 'full': pan, zoom, pinch, and node collapse/expand.
     * - 'pan-only': restrict to panning and node collapse/expand (no zooming).
     * - 'none': render-only, no interactions.
     */
    interactionMode?: 'full' | 'pan-only' | 'none';
    initialAutoFitScaleMultiplier?: number;
    initialAutoFitCenterBias?: AutoFitCenterBiasOptions;
}

interface RgbColor { r: number; g: number; b: number; }
interface HslColor { h: number; s: number; l: number; }

// ============== CONSTANTS ==============

const HORIZONTAL_SPACING = 150;
const VERTICAL_SPACING = 10;
const PADDING = 50;
const ANIMATION_DURATION = 300;

// Light Mode Color Palette
const L_TEXT_COLOR_PALETTE = [
    'hsla(0, 65%, 35%, 1.00)',
    'hsla(83, 82%, 25%, 1.00)',
    'hsla(208, 82%, 29%, 1.00)',
    'hsla(162, 82%, 25%, 1.00)',
    'hsla(341, 70%, 29%, 1.00)',
    'hsla(285, 70%, 29%, 1.00)',
    'hsla(100, 85%, 29%, 1.00)',
    'hsla(54, 85%, 31%, 1.00)',
    'hsla(354, 82%, 29%, 1.00)'
];
const L_THEME_COLOR_PALETTE = [
    'hsla(0, 65%, 45%, 1.00)',
    'hsla(83, 82%, 35%, 1.00)',
    'hsla(208, 82%, 39%, 1.00)',
    'hsla(162, 82%, 35%, 1.00)',
    'hsla(341, 70%, 39%, 1.00)',
    'hsla(285, 70%, 39%, 1.00)',
    'hsla(100, 85%, 39%, 1.00)',
    'hsla(54, 85%, 41%, 1.00)',
    'hsla(354, 82%, 39%, 1.00)'
];

// Dark Mode Color Palette
const D_TEXT_COLOR_PALETTE = [
    'hsla(04, 65%, 95%, 1.00)',
    'hsla(83, 82%, 95%, 1.00)',
    'hsla(208, 82%, 95%, 1.00)',
    'hsla(162, 82%, 95%, 1.00)',
    'hsla(341, 70%, 95%, 1.00)',
    'hsla(285, 70%, 95%, 1.00)',
    'hsla(100, 85%, 95%, 1.00)',
    'hsla(54, 85%, 95%, 1.00)',
    'hsla(354, 82%, 95%, 1.00)'
];
const D_THEME_COLOR_PALETTE = [
    'hsla(04, 100%, 85%, 1.00)',
    'hsla(83, 100%, 85%, 1.00)',
    'hsla(208, 100%, 85%, 1.00)',
    'hsla(162, 100%, 85%, 1.00)',
    'hsla(341, 100%, 85%, 1.00)',
    'hsla(285, 100%, 85%, 1.00)',
    'hsla(100, 100%, 85%, 1.00)',
    'hsla(54, 100%, 85%, 1.00)',
    'hsla(354, 100%, 85%, 1.00)'
];

// Dynamically select palette based on dark mode media query
const isDarkMode = () => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
        return false;
    }
    // 1. Check for theme override from the app's theme toggle
    const appTheme = document.documentElement.dataset.theme;
    if (appTheme === 'dark') return true;
    if (appTheme === 'light') return false;
    // 2. Fallback to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};
const getThemeColorPalette = () => isDarkMode() ? D_THEME_COLOR_PALETTE : L_THEME_COLOR_PALETTE;
const getTextColorPalette = () => isDarkMode() ? D_TEXT_COLOR_PALETTE : L_TEXT_COLOR_PALETTE;


// Optional initial pan offsets applied on first render/initialization
const INITIAL_PAN_X_OFFSET = -400;
const INITIAL_PAN_Y_OFFSET = 0;

// ============== MODULE STATE ==============
// These variables manage the state of a single mind map instance.

let mindMapTree: MindMapNode | null = null;
let stableRootY: number | null = null;
let mapContainer: HTMLElement;
let viewport: HTMLElement;
let svg: SVGSVGElement;
let lastMarkdown: string = '';

// Pan and Zoom State
let scale = 1, panX = 0, panY = 0;
let interactionMode: 'full' | 'pan-only' | 'none' = 'full';
let panEnabled = true;
let zoomEnabled = true;
let nodeInteractionsEnabled = true;
let userHasInteracted = false; // Track if user has manually panned or zoomed
let themeObserver: MutationObserver | null = null;
// Mouse panning state
let isPanning = false, startX = 0, startY = 0;
// Touch gesture state
let isPinching = false, initialDistance = 0;
let lastTouchX = 0, lastTouchY = 0; // For single-finger panning
// Touch gesture state for distinguishing taps from drags
let touchStartTime = 0;
let touchStartX = 0;
let touchStartY = 0;
let ignoreTap = false;
const TAP_DISTANCE_THRESHOLD = 10; // pixels
// Transform animation state
let transformAnimationToken = 0;

const TEXT_PROXIMITY_THRESHOLD = 1;

function getTextClientRects(nodeEl: HTMLElement): DOMRect[] {
    const rects: DOMRect[] = [];
    const walker = document.createTreeWalker(
        nodeEl,
        NodeFilter.SHOW_TEXT,
        {
            acceptNode(node) {
                return node.textContent && node.textContent.trim().length > 0
                    ? NodeFilter.FILTER_ACCEPT
                    : NodeFilter.FILTER_REJECT;
            }
        }
    );
    let current: Node | null = walker.nextNode();
    while (current) {
        const range = document.createRange();
        range.selectNodeContents(current);
        const clientRects = range.getClientRects();
        for (let i = 0; i < clientRects.length; i++) {
            const rect = clientRects[i];
            if (rect.width === 0 && rect.height === 0) continue;
            rects.push(rect);
        }
        if (typeof range.detach === 'function') {
            range.detach();
        }
        current = walker.nextNode();
    }
    return rects;
}

function isPointNearNodeText(nodeEl: HTMLElement, clientX: number, clientY: number): boolean {
    const rects = getTextClientRects(nodeEl);
    for (const rect of rects) {
        const clampedX = Math.max(rect.left, Math.min(clientX, rect.right));
        const clampedY = Math.max(rect.top, Math.min(clientY, rect.bottom));
        const dx = clientX - clampedX;
        const dy = clientY - clampedY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance <= TEXT_PROXIMITY_THRESHOLD) {
            return true;
        }
    }
    return false;
}

function shouldBlockPanAtPoint(target: EventTarget | null, clientX: number, clientY: number, isTouchEvent = false): boolean {
    if (!(target instanceof Element)) return false;
    const nodeEl = target.closest('.mindmap-node') as HTMLElement | null;
    if (!nodeEl) return false;

    // On mobile touch events only, don't block panning even over text
    // Mobile users use press-and-hold for text selection, so they should be able to pan freely
    // Desktop mouse events should still block panning to allow text selection
    if (isTouchEvent) {
        return false;
    }

    return isPointNearNodeText(nodeEl, clientX, clientY);
}

// ============== PERFORMANCE STATE (RAF + CACHING) ==============
// Schedule transform writes to next animation frame to avoid flooding style updates
let transformRafId: number | null = null;
// Cache viewport rect during interactions to avoid layout thrash
let viewportRect: DOMRect | null = null;
let viewportRectDirty = true;
// Transient will-change timer for the container to improve smoothness without long-lived layers
let willChangeTimeoutId: number | null = null;

// Initial pan offset state (can be overridden via initialize options)
let initialPanXOffset = INITIAL_PAN_X_OFFSET;
let initialPanYOffset = INITIAL_PAN_Y_OFFSET;
let initialAutoFitScaleMultiplier = 1;
let initialAutoFitCenterBiasX = 0;
let initialAutoFitCenterBiasY = 0;

// ============== MEASUREMENT CACHE ==============
// Reuse a single hidden measurement host and cache results to avoid repeated layout & KaTeX work
let measureHost: HTMLElement | null = null;
const measurementCache: Map<string, { width: number; height: number }> = new Map();
let measurementCacheVersion = 0;

function getMeasureHost(): HTMLElement {
    if (measureHost && document.body.contains(measureHost)) return measureHost;
    measureHost = document.createElement('div');
    measureHost.id = 'mindmap-measure-host';
    measureHost.style.position = 'absolute';
    measureHost.style.left = '-10000px';
    measureHost.style.top = '0';
    measureHost.style.visibility = 'hidden';
    measureHost.style.pointerEvents = 'none';
    document.body.appendChild(measureHost);
    return measureHost;
}

function getMeasurementCacheKey(html: string, isRoot: boolean): string {
    const theme = document.documentElement.dataset.theme || '';
    const dark = isDarkMode() ? '1' : '0';
    return `${measurementCacheVersion}|${dark}|${theme}|${isRoot ? 'root' : 'node'}|${html}`;
}

function measureHtmlSize(html: string, isRoot: boolean): { width: number; height: number } {
    const key = getMeasurementCacheKey(html, isRoot);
    const cached = measurementCache.get(key);
    if (cached) return cached;

    const host = getMeasureHost();
    const tempNode = document.createElement('div');
    tempNode.className = 'mindmap-node';
    if (isRoot) tempNode.classList.add('root');
    tempNode.innerHTML = html;
    host.appendChild(tempNode);
    if ((window as any).renderMathInElement) {
        (window as any).renderMathInElement(tempNode, {
            delimiters: [
                { left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    }
    const size = { width: tempNode.offsetWidth, height: tempNode.offsetHeight };
    host.removeChild(tempNode);
    measurementCache.set(key, size);
    return size;
}

function invalidateMeasurementCache() {
    measurementCache.clear();
    measurementCacheVersion++;
    if (measureHost && measureHost.parentNode) {
        measureHost.parentNode.removeChild(measureHost);
    }
    measureHost = null;
}

// ============== COLOR HELPER FUNCTIONS ==============

function hexToRgb(hex: string): RgbColor {
    if (!hex) return { r: 0, g: 0, b: 0 };
    let r = 0, g = 0, b = 0;
    if (hex.startsWith('#')) {
        r = parseInt(hex.slice(1, 3), 16);
        g = parseInt(hex.slice(3, 5), 16);
        b = parseInt(hex.slice(5, 7), 16);
    }
    return { r, g, b };
}

function colorToRgb(color: string): RgbColor {
    if (!color) return { r: 0, g: 0, b: 0 };
    if (color.startsWith('#')) return hexToRgb(color);
    if (color.startsWith('hsl')) {
        const match = color.match(/hsla?\((\d+),\s*([\d.]+)%,\s*([\d.]+)%/);
        if (!match) return { r: 0, g: 0, b: 0 };
        const h = parseInt(match[1], 10) / 360;
        const s = parseFloat(match[2]) / 100;
        const l = parseFloat(match[3]) / 100;
        return hslToRgb(h, s, l);
    }
    return { r: 0, g: 0, b: 0 };
}

function rgbToHex(r: number, g: number, b: number): string {
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0')}`;
}

function rgbToHsl(r: number, g: number, b: number): HslColor {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number): RgbColor {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

function varyHue(color: string, amount: number): string {
    const { r, g, b } = colorToRgb(color);
    let { h, s, l } = rgbToHsl(r, g, b);
    h = (h + amount + 1) % 1;
    const { r: newR, g: newG, b: newB } = hslToRgb(h, s, l);
    return rgbToHex(newR, newG, newB);
}

function darkenColor(color: string, percent: number): string {
    if (!color) return '#000000';
    let { r, g, b } = colorToRgb(color);
    const amount = 1 - percent / 100;
    r = Math.floor(r * amount);
    g = Math.floor(g * amount);
    b = Math.floor(b * amount);
    return rgbToHex(r, g, b);
}

function saturateColor(color: string, percent: number): string {
    if (!color) return '#000000';
    let { r, g, b } = colorToRgb(color);
    let { h, s, l } = rgbToHsl(r, g, b);
    s = Math.min(1, s * (1 + percent / 100));
    const { r: newR, g: newG, b: newB } = hslToRgb(h, s, l);
    return rgbToHex(newR, newG, newB);
}

// ============== MARKDOWN PARSING ==============

function renderMarkdownToHTML(text: string): string {
    return text
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" onclick="event.stopPropagation()">$1</a>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/__(.*?)__/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/_(.*?)_/g, '<em>$1</em>')
        .replace(/~~(.*?)~~/g, '<del>$1</del>').replace(/==(.*?)\==/g, '<mark>$1</mark>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
}

function parseFrontmatter(markdown: string): { frontmatter: Record<string, string>, content: string } {
    const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
    if (!match) return { frontmatter: {}, content: markdown };
    const frontmatter: Record<string, string> = {};
    const yaml = match[1];
    yaml.split('\n').forEach(line => {
        const parts = line.split(':');
        if (parts.length >= 2) { frontmatter[parts[0].trim()] = parts.slice(1).join(':').trim(); }
    });
    return { frontmatter, content: markdown.substring(match[0].length) };
}

function applyColorVariations(node: MindMapNode) {
    const childrenWithSubtrees = node.children.filter(child => child.children.length > 0);
    if (node.themeColor && childrenWithSubtrees.length >= 2) {
        const n = childrenWithSubtrees.length;
        const HUE_VARIATION = 0.03;
        const baseColor = node.themeColor;
        const baseTextColor = node.textColor ?? (baseColor ? darkenColor(baseColor, 70) : null);
        childrenWithSubtrees.forEach((childNode, index) => {
            const variationStep = n === 1 ? 0 : (index / (n - 1)) * 2 - 1;
            const hueShift = HUE_VARIATION * variationStep;
            const variedColor = varyHue(baseColor, hueShift);
            const variedTextColor = baseTextColor ? varyHue(baseTextColor, hueShift) : null;
            function setSubtreeStyle(subtreeNode: MindMapNode, color: string, textColor: string | null) {
                subtreeNode.themeColor = color;
                if (textColor) subtreeNode.textColor = textColor;
                subtreeNode.children.forEach(child => setSubtreeStyle(child, color, textColor));
            }
            setSubtreeStyle(childNode, variedColor, variedTextColor);
        });
    }
    node.children.forEach(applyColorVariations);
}

interface MarkdownToken {
    type: 'heading' | 'list';
    level: number;
    indent: number;
    text: string;
    isFolded: boolean;
}

function tokenizeMarkdown(lines: string[], getIndent: (line: string) => number): MarkdownToken[] {
    const tokens: MarkdownToken[] = [];
    for (const originalLine of lines) {
        if (originalLine.trim() === '') continue;
        let processedLine = originalLine;
        let isFolded = false;
        if (processedLine.includes('<!-- markmap: fold -->')) {
            isFolded = true;
            processedLine = processedLine.replace('<!-- markmap: fold -->', '');
        }
        const headingMatch = processedLine.match(/^(#+)\s(.*)/);
        if (headingMatch) {
            tokens.push({
                type: 'heading',
                level: headingMatch[1].length,
                indent: 0,
                text: headingMatch[2].trim(),
                isFolded
            });
            continue;
        }
        const listItemMatch = processedLine.match(/^(\s*)(\*|-|\d+\.)\s(.*)/);
        if (listItemMatch) {
            const indent = getIndent(listItemMatch[1]);
            tokens.push({
                type: 'list',
                level: 0,
                indent,
                text: listItemMatch[3].trim(),
                isFolded
            });
            continue;
        }
        if (tokens.length === 0 || !/^\s+/.test(originalLine)) continue;
        const lastToken = tokens[tokens.length - 1];
        const continuation = processedLine.trim();
        if (!continuation) continue;
        lastToken.text = `${lastToken.text}\n${continuation}`;
        lastToken.isFolded = lastToken.isFolded || isFolded;
    }
    return tokens;
}

export function parseMarkmap(markdown: string): MindMapNode {
    const { frontmatter, content } = parseFrontmatter(markdown);
    let lines = content.split('\n');
    const getIndent = (line: string) => (line.match(/^\s*/) as RegExpMatchArray)[0].length;
    let nodeCounter = 1;
    let colorIndex = 0;
    let rootText = frontmatter.title || "Mind Map";
    const h1Index = lines.findIndex(line => line.trim().startsWith('# '));
    if (h1Index !== -1) {
        rootText = lines[h1Index].trim().substring(2);
        lines.splice(h1Index, 1);
    }
    const tokens = tokenizeMarkdown(lines, getIndent);
    const rootThemeColor = isDarkMode() ? 'hsla(213, 82%, 85%, 1.00)' : 'hsla(208, 82%, 39%, 1.00)';
    const rootTextColor = isDarkMode() ? 'hsla(213, 82%, 95%, 1.00)' : 'hsla(208, 82%, 29%, 1.00)';
    const root: MindMapNode = {
        id: 'node-0', text: rootText, html: renderMarkdownToHTML(rootText),
        children: [], level: 0, isRoot: true, themeColor: rootThemeColor, textColor: rootTextColor, parent: null,
        width: 0, height: 0, x: 0, y: 0
    };
    const parentStack = [root];
    let lastHeadingLevel = 0;
    for (const token of tokens) {
        let text = token.text;
        const hasFoldMarker = text.includes('<!-- markmap: fold -->') || token.isFolded;
        if (hasFoldMarker) {
            text = text.replace('<!-- markmap: fold -->', '');
        }
        let level;
        if (token.type === 'heading') {
            level = token.level;
            text = text.trim();
            if (level >= 2 && level <= 4) {
                text = `**${text}**`;
            }
            lastHeadingLevel = level;
        } else {
            text = text.trim();
            const pseudoHeading = text.match(/^#{2,4}\s+(.*)$/);
            if (pseudoHeading) {
                text = `**${pseudoHeading[1].trim()}**`;
            }
            level = lastHeadingLevel + 1 + Math.floor(token.indent / 2);
        }
        text = text.trim();
        while (parentStack[parentStack.length - 1].level >= level) {
            parentStack.pop();
        }
        const parent = parentStack[parentStack.length - 1];
        let nodeThemeColor: string | null;
        let nodeTextColor: string | null;
        if (parent.isRoot) {
            const THEME_COLOR_PALETTE = getThemeColorPalette();
            const TEXT_COLOR_PALETTE = getTextColorPalette();
            const idx = colorIndex++ % THEME_COLOR_PALETTE.length;
            nodeThemeColor = THEME_COLOR_PALETTE[idx];
            nodeTextColor = TEXT_COLOR_PALETTE[idx] ?? darkenColor(nodeThemeColor, 70);
        } else {
            nodeThemeColor = parent.themeColor;
            nodeTextColor = parent.textColor ?? (nodeThemeColor ? darkenColor(nodeThemeColor, 70) : null);
        }
        const newNode: MindMapNode = {
            id: `node-${nodeCounter++}`, text: text, html: renderMarkdownToHTML(text),
            children: [],
            // Only collapse if explicitly folded in markdown
            isCollapsed: hasFoldMarker,
            level: level,
            parent: parent,
            themeColor: nodeThemeColor,
            textColor: nodeTextColor,
            width: 0, height: 0, x: 0, y: 0
        };
        parent.children.push(newNode);
        parentStack.push(newNode);
    }
    return root;
}

// ============== DOM & SVG RENDERING ==============

function applyTransform() {
    if (mapContainer) {
        mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    }
}

// Request a transform update on the next animation frame
function requestTransformUpdate() {
    if (transformRafId !== null) return;
    transformRafId = requestAnimationFrame(() => {
        transformRafId = null;
        applyTransform();
    });
}

function getViewportRect(): DOMRect {
    if (viewportRectDirty || !viewportRect) {
        viewportRect = viewport.getBoundingClientRect();
        viewportRectDirty = false;
    }
    return viewportRect;
}

function invalidateViewportRect() {
    viewportRectDirty = true;
}

function bumpContainerWillChange() {
    if (!mapContainer) return;
    mapContainer.style.willChange = 'transform';
    if (willChangeTimeoutId !== null) {
        window.clearTimeout(willChangeTimeoutId);
    }
    // Remove the hint shortly after interaction stops to prevent blurriness
    willChangeTimeoutId = window.setTimeout(() => {
        if (mapContainer) mapContainer.style.removeProperty('will-change');
        willChangeTimeoutId = null;
    }, 200);
}

// Smoothly animate pan and zoom to the target transform
function animateTransformTo(targetScale: number, targetPanX: number, targetPanY: number, duration = ANIMATION_DURATION) {
    const startScale = scale;
    const startPanX = panX;
    const startPanY = panY;
    const startTime = performance.now();
    const token = ++transformAnimationToken;

    const easeInOutCubic = (t: number) => (t < 0.5)
        ? 4 * t * t * t
        : 1 - Math.pow(-2 * t + 2, 3) / 2;

    function step(now: number) {
        if (token !== transformAnimationToken) return; // cancelled by interaction or new anim
        const elapsed = now - startTime;
        const t = Math.min(1, elapsed / duration);
        const e = easeInOutCubic(t);

        scale = startScale + (targetScale - startScale) * e;
        panX = startPanX + (targetPanX - startPanX) * e;
        panY = startPanY + (targetPanY - startPanY) * e;
        applyTransform();

        if (t < 1) {
            requestAnimationFrame(step);
        } else {
            if (mindMapTree) {
                stableRootY = mindMapTree.y;
            }
        }
    }

    requestAnimationFrame(step);
}

function autoFitView(markdown: string) {
    if (!viewport) return;

    const bounds = getFullMindMapBounds(markdown);
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    // Use 99.5% of viewport to leave a smaller margin
    const effectiveWidth = viewportWidth * 0.995;
    const effectiveHeight = viewportHeight * 0.995;

    const contentWidth = bounds.width + PADDING * 2;
    const contentHeight = bounds.height + PADDING * 2;

    const scaleX = effectiveWidth / contentWidth;
    const scaleY = effectiveHeight / contentHeight;

    const baseScale = Math.min(scaleX, scaleY, 2);
    const multiplier = Math.max(initialAutoFitScaleMultiplier, 0.1);
    scale = Math.min(baseScale * multiplier, 2); // Cap max zoom

    const contentCenterX = bounds.minX + PADDING + bounds.width / 2;
    const contentCenterY = bounds.minY + PADDING + bounds.height / 2;

    const viewportBiasX = viewportWidth * initialAutoFitCenterBiasX;
    const viewportBiasY = viewportHeight * initialAutoFitCenterBiasY;

    panX = (viewportWidth / 2 + viewportBiasX) - (contentCenterX * scale);
    panY = (viewportHeight / 2 + viewportBiasY) - (contentCenterY * scale);

    applyTransform();
    // After auto-fitting, we need to update stableRootY as if the root was centered,
    // to prevent pan jumps on subsequent interactions.
    if (mindMapTree) {
        stableRootY = mindMapTree.y;
    }
}

// Auto-fit the view to the CURRENT rendered tree state (respects collapsed nodes)
function autoFitToCurrentTree() {
    if (!viewport || !mindMapTree) return;

    const bounds = getTreeBounds(mindMapTree);
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    // Use 99.5% of viewport to leave a smaller margin
    const effectiveWidth = viewportWidth * 0.7;
    const effectiveHeight = viewportHeight * 0.7;

    const contentWidth = bounds.width + PADDING * 2;
    const contentHeight = bounds.height + PADDING * 2;

    const scaleX = effectiveWidth / contentWidth;
    const scaleY = effectiveHeight / contentHeight;

    const targetScale = Math.min(scaleX, scaleY, 2); // Cap max zoom

    const contentCenterX = bounds.minX + PADDING + bounds.width / 2;
    const contentCenterY = bounds.minY + PADDING + bounds.height / 2;

    const targetPanX = (viewportWidth / 2) - (contentCenterX * targetScale);
    const targetPanY = (viewportHeight / 2) - (contentCenterY * targetScale);

    animateTransformTo(targetScale, targetPanX, targetPanY, ANIMATION_DURATION + 100);
}


function measureNodeSizes(node: MindMapNode) {
    const { width, height } = measureHtmlSize(node.html, !!node.isRoot);
    node.width = width;
    node.height = height;
    if (!node.isCollapsed) node.children.forEach(measureNodeSizes);
}

function layoutTree(node: MindMapNode, x: number, y: number): number {
    node.x = x;
    node.y = y;
    if (node.isCollapsed || node.children.length === 0) return node.height;
    let currentChildY = y;
    node.children.forEach((child, index) => {
        const childSubtreeHeight = layoutTree(child, x + node.width + HORIZONTAL_SPACING, currentChildY);
        currentChildY += childSubtreeHeight;
        if (index < node.children.length - 1) currentChildY += VERTICAL_SPACING;
    });
    const totalChildHeight = currentChildY - y;
    const firstChild = node.children[0];
    const lastChild = node.children[node.children.length - 1];
    node.y = firstChild.y + (lastChild.y + lastChild.height - firstChild.y) / 2 - (node.height / 2);
    return Math.max(node.height, totalChildHeight);
}

function getTreeBounds(node: MindMapNode): { minX: number, minY: number, width: number, height: number, maxY: number } {
    let minX = node.x, maxX = node.x + node.width;
    let minY = node.y, maxY = node.y + node.height;
    function traverse(n: MindMapNode) {
        minX = Math.min(minX, n.x);
        maxX = Math.max(maxX, n.x + n.width);
        minY = Math.min(minY, n.y);
        maxY = Math.max(maxY, n.y + n.height);
        if (!n.isCollapsed) n.children.forEach(traverse);
    }
    traverse(node);
    return { minX, minY, width: maxX - minX, height: maxY - minY, maxY };
}

function findNodeById(node: MindMapNode | null, id: string): MindMapNode | null {
    if (!node) return null;
    if (node.id === id) return node;
    for (const child of node.children) {
        const match = findNodeById(child, id);
        if (match) return match;
    }
    return null;
}

function getSubtreeBounds(node: MindMapNode): { minX: number, minY: number, width: number, height: number } {
    let minX = node.x;
    let maxX = node.x + node.width;
    let minY = node.y;
    let maxY = node.y + node.height;

    const traverse = (current: MindMapNode) => {
        minX = Math.min(minX, current.x);
        maxX = Math.max(maxX, current.x + current.width);
        minY = Math.min(minY, current.y);
        maxY = Math.max(maxY, current.y + current.height);
        if (!current.isCollapsed) {
            current.children.forEach(traverse);
        }
    };

    traverse(node);

    return { minX, minY, width: maxX - minX, height: maxY - minY };
}

function drawConnector(parent: MindMapNode, child: MindMapNode, svgEl: SVGSVGElement, xOffset: number, yOffset: number, isExpanding: boolean): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connector-path');
    // Match connector color to the node's text color for visual consistency
    const connectorStroke = child.themeColor ?? '#000000';
    path.style.stroke = connectorStroke;
    const p1 = { x: parent.x + parent.width + xOffset, y: parent.y + parent.height / 2 + yOffset };
    const p2 = { x: child.x + xOffset, y: child.y + child.height / 2 + yOffset };
    const d = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p1.x) / 2} ${p1.y}, ${p1.x + (p2.x - p1.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`;
    path.setAttribute('d', d);
    svgEl.appendChild(path);

    // On expand, fade the connector in smoothly.
    if (isExpanding) {
        path.style.opacity = '0';
        // Use two RAFs to ensure styles are applied before the transition starts.
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                path.style.opacity = '1';
            });
        });
    }

    return path;
}

function renderNodeAndChildren(node: MindMapNode, container: HTMLElement, svgEl: SVGSVGElement, xOffset: number, yOffset: number, expandingSubtreeRoot: MindMapNode | null = null) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'mindmap-node';
    nodeEl.id = node.id;
    nodeEl.innerHTML = node.html;
    if ((window as any).renderMathInElement) {
        (window as any).renderMathInElement(nodeEl, {
            delimiters: [
                { left: '$$', right: '$$', display: true }, { left: '$', right: '$', display: false },
                { left: '\\(', right: '\\)', display: false }, { left: '\\[', right: '\\]', display: true }
            ],
            throwOnError: false
        });
    }

    const shouldAnimateIn = !!expandingSubtreeRoot;

    if (shouldAnimateIn) {
        nodeEl.style.left = `${expandingSubtreeRoot!.x + xOffset}px`;
        nodeEl.style.top = `${expandingSubtreeRoot!.y + yOffset}px`;
        nodeEl.style.opacity = '0';
        nodeEl.style.transform = 'scale(0.5)';
    } else {
        nodeEl.style.left = `${node.x + xOffset}px`;
        nodeEl.style.top = `${node.y + yOffset}px`;
    }

    if (node.themeColor) {
        const borderColor = node.themeColor;
        nodeEl.style.borderColor = borderColor;
        nodeEl.style.color = node.textColor ?? darkenColor(node.themeColor, 70);
        nodeEl.style.setProperty('--indicator-border-color', borderColor);
        nodeEl.style.setProperty('--collapsed-indicator-color', node.themeColor);
    }
    if (node.isRoot) {
        nodeEl.classList.add('root');
        // Use explicit text color if provided, otherwise derive from background
        nodeEl.style.color = node.textColor ?? darkenColor(node.themeColor || '#b5d9ffff', 70);
    }
    if (node.children.length > 0) nodeEl.classList.add('has-children');
    if (node.isCollapsed) nodeEl.classList.add('collapsed');

    nodeEl.addEventListener('click', (e) => {
        if (!nodeInteractionsEnabled) return;
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'a') return;

        // Check if the user is selecting text within this node.
        const selection = window.getSelection();
        if (selection && !selection.isCollapsed && selection.anchorNode && nodeEl.contains(selection.anchorNode)) {
            // If there's a text selection that starts within this node,
            // assume the user wants to select text, not toggle the node.
            return;
        }

        e.stopPropagation();
        if (node.children.length > 0) toggleNodeCollapse(node);
    });

    // Add touch event handler for mobile tap detection
    nodeEl.addEventListener('touchend', (e) => {
        if (!nodeInteractionsEnabled) return;
        if ((e.target as HTMLElement).tagName.toLowerCase() === 'a') return;

        // Check if this was a tap (not part of panning)
        const touch = e.changedTouches[0];
        if (touch && !ignoreTap) {
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.anchorNode && nodeEl.contains(selection.anchorNode)) {
                return;
            }

            e.stopPropagation();
            e.preventDefault();
            if (node.children.length > 0) toggleNodeCollapse(node);
        }
    }, { passive: false });

    container.appendChild(nodeEl);

    if (shouldAnimateIn) {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                nodeEl.style.left = `${node.x + xOffset}px`;
                nodeEl.style.top = `${node.y + yOffset}px`;
                nodeEl.style.opacity = '1';
                nodeEl.style.transform = 'scale(1)';
                setTimeout(() => {
                    nodeEl.style.transform = '';
                }, ANIMATION_DURATION);
            });
        });
    }

    if (node.parent) {
        node.connectorPath = drawConnector(node.parent, node, svgEl, xOffset, yOffset, shouldAnimateIn);
    }

    if (!node.isCollapsed) {
        let childrenExpandingRoot = expandingSubtreeRoot;
        if (node.isExpanding) {
            childrenExpandingRoot = node;
        }
        node.children.forEach(child => renderNodeAndChildren(child, container, svgEl, xOffset, yOffset, childrenExpandingRoot));
    }
}

// ============== INTERACTION & ANIMATION ==============

function toggleNodeCollapse(node: MindMapNode) {
    if (node.isAnimating) return;
    node.isAnimating = true;

    if (node.isCollapsed) { // EXPAND
        // Uncollapse this node and all its descendants so the whole subtree unfolds
        function expandSubtree(n: MindMapNode) {
            n.isCollapsed = false;
            n.children.forEach(expandSubtree);
        }
        expandSubtree(node);

        node.isExpanding = true;
        rerenderMindMap();
        setTimeout(() => {
            delete node.isExpanding;
            node.isAnimating = false;
        }, ANIMATION_DURATION);

    } else { // COLLAPSE
        const allNodes: MindMapNode[] = [];
        const descendantNodes: MindMapNode[] = [];
        function traverse(n: MindMapNode, isDescendant = false) {
            allNodes.push(n);
            n.startX = n.x;
            n.startY = n.y;
            if (isDescendant) descendantNodes.push(n);
            if (!n.isCollapsed || n === node) {
                n.children.forEach(child => traverse(child, isDescendant || n === node));
            }
        }
        if (mindMapTree) traverse(mindMapTree);

        // Set node to collapsed and recalculate layout for final positions.
        node.isCollapsed = true;
        if (mindMapTree) layoutTree(mindMapTree, 0, 0);

        // Adjust pan to keep root stable
        const newRootY = mindMapTree!.y;
        if (stableRootY !== null) {
            const deltaY = newRootY - stableRootY;
            if (deltaY !== 0) {
                panY -= deltaY * scale;
                applyTransform();
            }
        }
        stableRootY = newRootY;

        // Store final positions
        allNodes.forEach(n => { n.endX = n.x; n.endY = n.y; });

        // Pre-position elements at their final absolute positions and animate via transforms only
        const prepositions = new Map<MindMapNode, { finalX: number; finalY: number }>();
        const targetFinalX = node.endX!;
        const targetFinalY = node.endY!;
        allNodes.forEach(n => {
            const isDescendant = descendantNodes.includes(n);
            const finalX = isDescendant ? targetFinalX : n.endX!;
            const finalY = isDescendant ? targetFinalY : n.endY!;
            prepositions.set(n, { finalX, finalY });
            const el = document.getElementById(n.id);
            if (el) {
                el.style.transition = 'none';
                el.style.left = `${finalX + PADDING}px`;
                el.style.top = `${finalY + PADDING}px`;
                // For the root node, we want it to be static. Its apparent motion is handled by panning the container.
                if (n.isRoot) {
                    el.style.transform = `translate(0px, 0px) scale(1)`;
                } else {
                    const dx0 = (n.startX! - finalX);
                    const dy0 = (n.startY! - finalY);
                    el.style.transform = `translate(${dx0}px, ${dy0}px) scale(1)`;
                }
                // Force reflow to apply styles immediately before animation starts
                void (el as HTMLElement).offsetWidth;
            }
        });
        const startTime = performance.now();

        function animate(currentTime: number) {
            const elapsedTime = currentTime - startTime;
            const progress = Math.min(elapsedTime / ANIMATION_DURATION, 1);
            const easedProgress = 1 - Math.pow(1 - progress, 3); // easeOutCubic

            allNodes.forEach(n => {
                if (n.isRoot) {
                    n.animX = n.endX;
                    n.animY = n.endY;
                    // No need to update the DOM element's transform, it's static.
                    return;
                }

                let currentX, currentY, opacity = 1, scaleVal = 1;

                if (descendantNodes.includes(n)) {
                    const targetNode = node;
                    currentX = n.startX! + (targetNode.endX! - n.startX!) * easedProgress;
                    currentY = n.startY! + (targetNode.endY! - n.startY!) * easedProgress;
                    opacity = 1 - easedProgress;
                    scaleVal = 1 - 0.5 * easedProgress;
                } else {
                    currentX = n.startX! + (n.endX! - n.startX!) * easedProgress;
                    currentY = n.startY! + (n.endY! - n.startY!) * easedProgress;
                }

                const el = document.getElementById(n.id);
                if (el) {
                    el.style.transition = 'none';
                    const { finalX, finalY } = prepositions.get(n)!;
                    const dx = currentX - finalX;
                    const dy = currentY - finalY;
                    el.style.opacity = String(opacity);
                    el.style.transform = `translate(${dx}px, ${dy}px) scale(${scaleVal})`;
                }
                n.animX = currentX;
                n.animY = currentY;
            });

            allNodes.forEach(n => {
                if (n.connectorPath && n.parent) {
                    const parent = n.parent;
                    const p1 = { x: parent.animX! + parent.width + PADDING, y: parent.animY! + parent.height / 2 + PADDING };
                    const p2 = { x: n.animX! + PADDING, y: n.animY! + n.height / 2 + PADDING };
                    const d = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p1.x) / 2} ${p1.y}, ${p1.x + (p2.x - p1.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`;
                    n.connectorPath.style.transition = 'none';
                    n.connectorPath.setAttribute('d', d);
                    if (descendantNodes.includes(n)) {
                        n.connectorPath.style.opacity = String(1 - easedProgress);
                    }
                }
            });

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                // After animation, remove inline styles from surviving nodes to re-enable hover effects
                allNodes.forEach(n => {
                    if (!descendantNodes.includes(n)) {
                        const el = document.getElementById(n.id);
                        if (el) {
                            el.style.transition = '';
                            el.style.transform = '';
                        }
                    }
                });

                node.isAnimating = false;
                rerenderMindMap();
            }
        }
        requestAnimationFrame(animate);
    }
}

// ============== MAIN RENDER FUNCTION ==============

function rerenderMindMap() {
    if (!mindMapTree || !mapContainer) return;

    mapContainer.innerHTML = '';
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'mindmap-svg';
    mapContainer.appendChild(svg);

    measureNodeSizes(mindMapTree);
    layoutTree(mindMapTree, 0, 0);

    const newRootY = mindMapTree.y;
    if (stableRootY === null) {
        const rootNodeCenterXInLayout = PADDING + mindMapTree.width / 2;
        const rootNodeCenterYInLayout = PADDING + newRootY + mindMapTree.height / 2;
        panX = viewport.clientWidth / 2 - rootNodeCenterXInLayout + initialPanXOffset;
        panY = viewport.clientHeight / 2 - rootNodeCenterYInLayout + initialPanYOffset;
    } else {
        const deltaY = newRootY - stableRootY;
        if (deltaY !== 0) panY -= deltaY * scale;
    }
    stableRootY = newRootY;

    applyTransform();
    renderNodeAndChildren(mindMapTree, mapContainer, svg, PADDING, PADDING, null);

    const bounds = getTreeBounds(mindMapTree);
    mapContainer.style.width = `${bounds.width + 2 * PADDING}px`;
    mapContainer.style.height = `${bounds.maxY + 2 * PADDING}px`;
    svg.setAttribute('width', mapContainer.style.width);
    svg.setAttribute('height', mapContainer.style.height);
}

// ============== EVENT HANDLERS ==============

function handleWheel(e: WheelEvent) {
    if (!zoomEnabled) return;
    e.preventDefault();
    userHasInteracted = true;
    // Cancel ongoing transform animation on user interaction
    transformAnimationToken++;
    const rect = getViewportRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const oldScale = scale;
    const DOM_DELTA_PIXEL = 0;
    const isTrackpadLike = e.ctrlKey || (e.deltaMode === DOM_DELTA_PIXEL && Math.abs(e.deltaY) < 40);
    let nextScale = scale;

    if (isTrackpadLike) {
        const zoomIntensity = 0.013;
        const zoomDelta = -e.deltaY * zoomIntensity;
        const multiplier = 1 + zoomDelta;
        if (multiplier > 0) {
            nextScale = scale * multiplier;
        }
    } else {
        const zoomStep = 0.1;
        nextScale = scale + (e.deltaY < 0 ? zoomStep : -zoomStep);
    }

    scale = Math.max(0.1, Math.min(5, nextScale));
    panX = mouseX - (mouseX - panX) * (scale / oldScale);
    panY = mouseY - (mouseY - panY) * (scale / oldScale);
    bumpContainerWillChange();
    requestTransformUpdate();
}

function handleDarkModeChange() {
    // Rerender only if theme is 'system'
    const appTheme = document.documentElement.dataset.theme;
    if (appTheme === 'system' || !appTheme) {
        invalidateMeasurementCache();
        rerenderMindMap();
    }
}

function handleMouseDown(e: MouseEvent) {
    if (!panEnabled) return;
    if (shouldBlockPanAtPoint(e.target, e.clientX, e.clientY)) {
        isPanning = false;
        return;
    }
    e.preventDefault();
    userHasInteracted = true;
    // Cancel ongoing transform animation on user interaction
    transformAnimationToken++;
    isPanning = true;
    startX = e.clientX - panX;
    startY = e.clientY - panY;
}

function handleMouseUp() {
    isPanning = false;
}

function handleMouseMove(e: MouseEvent) {
    if (!panEnabled || !isPanning) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    bumpContainerWillChange();
    requestTransformUpdate();
}

// ============== TOUCH EVENT HANDLERS (for Mobile) ==============

function getDistance(touches: TouchList): number {
    const [touch1, touch2] = [touches[0], touches[1]];
    return Math.sqrt(Math.pow(touch2.clientX - touch1.clientX, 2) + Math.pow(touch2.clientY - touch1.clientY, 2));
}

function getMidpoint(touches: TouchList): { x: number, y: number } {
    const [touch1, touch2] = [touches[0], touches[1]];
    return {
        x: (touch1.clientX + touch2.clientX) / 2,
        y: (touch1.clientY + touch2.clientY) / 2,
    };
}

function handleTouchStart(e: TouchEvent) {
    if (!panEnabled && !zoomEnabled) return;
    e.preventDefault();
    userHasInteracted = true;
    // Cancel ongoing transform animation on user interaction
    transformAnimationToken++;

    if (e.touches.length === 2) {
        if (!zoomEnabled) return;
        isPinching = true;
        isPanning = false; // Ensure single-finger panning is off
        initialDistance = getDistance(e.touches);
    } else if (e.touches.length === 1 && panEnabled) {
        // Record touch start for gesture detection
        touchStartTime = performance.now();
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        ignoreTap = false;
        isPanning = false; // Don't start panning immediately
        isPinching = false;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    }
}

function handleTouchMove(e: TouchEvent) {
    if (!panEnabled && !zoomEnabled) return;
    if (!isPanning && !isPinching) {
        // Check if this is a single touch that has moved beyond threshold
        if (e.touches.length === 1) {
            const touch = e.touches[0];
            const deltaX = Math.abs(touch.clientX - touchStartX);
            const deltaY = Math.abs(touch.clientY - touchStartY);
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

            if (distance > TAP_DISTANCE_THRESHOLD) {
                // This is a drag, not a tap - start panning
                ignoreTap = true;
                isPanning = true;
            } else {
                return; // Still within tap threshold, don't prevent default yet
            }
        } else {
            return; // Not a single touch
        }
    }

    e.preventDefault();

    if (isPinching && zoomEnabled && e.touches.length === 2) { // Zooming
        const newDistance = getDistance(e.touches);
        const oldScale = scale;
        const scaleFactor = newDistance / initialDistance;
        scale = Math.max(0.1, Math.min(oldScale * scaleFactor, 5));
        initialDistance = newDistance; // Update for next move event

        const rect = getViewportRect();
        const midpoint = getMidpoint(e.touches);
        const midpointX = midpoint.x - rect.left;
        const midpointY = midpoint.y - rect.top;

        panX = midpointX - (midpointX - panX) * (scale / oldScale);
        panY = midpointY - (midpointY - panY) * (scale / oldScale);

    } else if (isPanning && panEnabled && e.touches.length === 1) { // Panning
        const touch = e.touches[0];
        panX += touch.clientX - lastTouchX;
        panY += touch.clientY - lastTouchY;
        lastTouchX = touch.clientX;
        lastTouchY = touch.clientY;
    }
    bumpContainerWillChange();
    requestTransformUpdate();
}

function handleTouchEnd(e: TouchEvent) {
    if (!panEnabled && !zoomEnabled) return;
    if (e.touches.length < 2) isPinching = false;
    if (e.touches.length < 1) {
        isPanning = false;
        // Reset touch gesture state
        touchStartTime = 0;
        touchStartX = 0;
        touchStartY = 0;
        ignoreTap = false;
    }
}

// ============== PUBLIC API ==============

function handleSelectionChange() {
    if (!mapContainer) return;
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed &&
        selection.anchorNode && mapContainer.contains(selection.anchorNode);

    if (hasSelection) {
        mapContainer.classList.add('is-selecting');
    } else {
        mapContainer.classList.remove('is-selecting');
    }
}

/**
 * Initializes the mind map renderer and draws the mind map.
 * @param markdown The markdown string to render.
 * @param targetViewport The viewport element that contains the map and handles pan/zoom.
 * @param targetContainer The container element where the mind map nodes will be rendered.
 */
export function initializeMindMap(
    markdown: string,
    targetViewport: HTMLElement,
    targetContainer: HTMLElement,
    options?: InitializeOptions,
) {
    // Reset state for new render
    scale = 1;
    panX = 0;
    panY = 0;
    stableRootY = null;
    userHasInteracted = false;
    // Reset perf caches
    viewportRect = null;
    viewportRectDirty = true;
    if (transformRafId !== null) {
        cancelAnimationFrame(transformRafId);
        transformRafId = null;
    }

    viewport = targetViewport;
    mapContainer = targetContainer;
    lastMarkdown = markdown;

    // Set initial offsets from options or fall back to defaults
    initialPanXOffset = options?.initialPanXOffset ?? INITIAL_PAN_X_OFFSET;
    initialPanYOffset = options?.initialPanYOffset ?? INITIAL_PAN_Y_OFFSET;
    initialAutoFitScaleMultiplier = options?.initialAutoFitScaleMultiplier ?? 1;
    initialAutoFitCenterBiasX = options?.initialAutoFitCenterBias?.x ?? 0;
    initialAutoFitCenterBiasY = options?.initialAutoFitCenterBias?.y ?? 0;

    const resolvedInteractionMode =
        options?.interactionMode ??
        (options?.disableInteractions ? 'none' : 'full');

    interactionMode = resolvedInteractionMode;
    panEnabled = interactionMode !== 'none';
    zoomEnabled = interactionMode === 'full';
    nodeInteractionsEnabled = interactionMode !== 'none';

    // Clean up previous event listeners
    cleanup();

    try {
        mindMapTree = parseMarkmap(markdown);
        // Apply color variations only to children of the root, not the root itself
        mindMapTree.children.forEach(child => applyColorVariations(child));
        rerenderMindMap();
        autoFitView(markdown);

        // Attach event listeners (unless disabled)
        if (interactionMode !== 'none') {
            if (zoomEnabled) {
                viewport.addEventListener('wheel', handleWheel, { passive: false });
            }
            if (panEnabled) {
                viewport.addEventListener('mousedown', handleMouseDown);
                window.addEventListener('mouseup', handleMouseUp);
                window.addEventListener('mousemove', handleMouseMove);
            }
            // Add touch event listeners for mobile (supports both pan and zoom)
            if (panEnabled || zoomEnabled) {
                viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
                viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
                window.addEventListener('touchend', handleTouchEnd);
            }
            // Listen for dark mode changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleDarkModeChange);
            // Keep cached viewport rect valid on resize
            window.addEventListener('resize', invalidateViewportRect, { passive: true });

            // Listen for selection changes to update cursor
            document.addEventListener('selectionchange', handleSelectionChange);

            // Observe data-theme attribute changes on <html> to react to theme toggle
            themeObserver = new MutationObserver(() => {
                invalidateMeasurementCache();
                rerenderMindMap();
            });
            themeObserver.observe(document.documentElement, {
                attributes: true,
                attributeFilter: ['data-theme', 'class']
            });
        }

    } catch (error) {
        console.error("Error rendering mind map:", error);
        targetContainer.innerHTML = `<div class="error">Failed to render mind map.</div>`;
    }
}

/**
 * Incrementally updates the current mind map with new markdown without resetting pan/zoom.
 * Safe to call repeatedly as new streamed tokens arrive.
 */
export function updateMindMap(markdown: string) {
    if (!mapContainer || !viewport) return;
    try {
        lastMarkdown = markdown;
        mindMapTree = parseMarkmap(markdown);
        mindMapTree.children.forEach(child => applyColorVariations(child));
        // Do not reset pan/zoom or stableRootY; rerender preserves position and animates connectors
        rerenderMindMap();
        if (!userHasInteracted) {
            autoFitView(markdown);
        }
    } catch (error) {
        // Fail quietly during partial streams
        // eslint-disable-next-line no-console
        console.warn('Incremental render failed for current partial markdown:', error);
    }
}

/**
 * Collapses the rendered mind map so that only the root and its immediate
 * children remain visible, with all other sub-branches hidden. Intended to be
 * called once streaming of markdown has completed.
 */
export function collapseToMainBranches(options?: { animate?: boolean }) {
    if (!mindMapTree) return;
    const animate = options?.animate !== false; // default true
    // Cancel any ongoing transform animation to avoid conflicting with collapse
    transformAnimationToken++;
    // Ensure root stays visible
    mindMapTree.isCollapsed = false;
    const shouldAutoFit = !userHasInteracted;

    if (animate) {
        // Collapse each immediate child's subtree (child stays visible) with animations
        const children = mindMapTree.children.slice();
        children.forEach((child) => {
            if (child.children.length > 0 && !child.isAnimating && !child.isCollapsed) {
                toggleNodeCollapse(child);
            }
        });
        // After collapse animation completes, ensure collapsed state and auto-fit
        setTimeout(() => {
            // Fallback: enforce collapse for any immediate child that still isn't collapsed
            if (mindMapTree) {
                mindMapTree.children.forEach((child) => {
                    if (child.children.length > 0 && !child.isCollapsed) {
                        child.isCollapsed = true;
                    }
                });
            }
            rerenderMindMap();
            if (shouldAutoFit) {
                autoFitToCurrentTree();
            }
        }, 0);
        return;
    }

    // No-animation path: mark children collapsed and rerender immediately
    const children = mindMapTree.children.slice();
    children.forEach((child) => {
        if (child.children.length > 0) {
            child.isCollapsed = true;
            child.isAnimating = false;
            delete child.isExpanding;
        }
    });
    rerenderMindMap();
    if (shouldAutoFit) {
        autoFitToCurrentTree();
    }
}

/**
 * Cleans up event listeners to prevent memory leaks.
 */
export function cleanup() {
    if (viewport) {
        viewport.removeEventListener('wheel', handleWheel);
        viewport.removeEventListener('mousedown', handleMouseDown);
        viewport.removeEventListener('touchstart', handleTouchStart);
        viewport.removeEventListener('touchmove', handleTouchMove);
    }
    window.removeEventListener('mouseup', handleMouseUp);
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('touchend', handleTouchEnd);
    window.removeEventListener('resize', invalidateViewportRect);
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', handleDarkModeChange);
    document.removeEventListener('selectionchange', handleSelectionChange);
    if (themeObserver) {
        themeObserver.disconnect();
        themeObserver = null;
    }
    if (willChangeTimeoutId !== null) {
        window.clearTimeout(willChangeTimeoutId);
        willChangeTimeoutId = null;
    }
    if (mapContainer) {
        mapContainer.style.removeProperty('will-change');
        mapContainer.classList.remove('is-selecting');
    }
    invalidateMeasurementCache();
}

/**
 * Calculates the bounds of the fully expanded mind map without affecting the live render.
 * This is a stateless function that takes markdown and returns the calculated bounds.
 * @param markdown The raw markdown of the mind map.
 * @returns The bounding box of the entire mind map, or null if markdown is invalid.
 */
export function getFullMindMapBounds(markdown: string): { minX: number, minY: number, width: number, height: number } | null {
    if (!markdown) return null;

    try {
        // 1. Parse the markdown to create a new, temporary tree.
        const tree = parseMarkmap(markdown);

        // 2. Fully expand the temporary tree in memory.
        function expandAll(node: MindMapNode) {
            node.isCollapsed = false;
            node.children.forEach(expandAll);
        }
        expandAll(tree);

        // 3. Measure and lay out the tree (this doesn't touch the live DOM).
        measureNodeSizes(tree);
        layoutTree(tree, 0, 0);

        // 4. Get the bounds of the fully expanded, laid-out tree.
        const { minX, minY, width, height } = getTreeBounds(tree);

        return { minX, minY, width, height };
    } catch (error) {
        console.error("Error calculating full mind map bounds:", error);
        return null;
    }
}

export interface FocusMindMapNodeOptions {
    animate?: boolean;
    paddingScale?: number;
}

export function focusMindMapNode(nodeId: string, options?: FocusMindMapNodeOptions): boolean {
    if (!mindMapTree || !viewport) return false;
    if (!nodeId) return false;

    const targetNode = findNodeById(mindMapTree, nodeId);
    if (!targetNode) return false;

    const bounds = getSubtreeBounds(targetNode);
    if (bounds.width === 0 && bounds.height === 0) return false;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;
    if (viewportWidth === 0 || viewportHeight === 0) return false;

    const paddingFactor = options?.paddingScale ?? 0.6;
    const horizontalPadding = PADDING * Math.max(0, paddingFactor);
    const verticalPadding = PADDING * Math.max(0, paddingFactor);

    const contentWidth = bounds.width + horizontalPadding * 2;
    const contentHeight = bounds.height + verticalPadding * 2;

    const scaleX = (viewportWidth * 0.9) / Math.max(contentWidth, 1);
    const scaleY = (viewportHeight * 0.9) / Math.max(contentHeight, 1);
    const targetScale = Math.min(scaleX, scaleY, 3);

    const contentCenterX = bounds.minX + bounds.width / 2 + PADDING;
    const contentCenterY = bounds.minY + bounds.height / 2 + PADDING;

    const targetPanX = viewportWidth / 2 - contentCenterX * targetScale;
    const targetPanY = viewportHeight / 2 - contentCenterY * targetScale;

    userHasInteracted = true;

    if (options?.animate === false) {
        scale = targetScale;
        panX = targetPanX;
        panY = targetPanY;
        applyTransform();
    } else {
        animateTransformTo(targetScale, targetPanX, targetPanY, ANIMATION_DURATION + 100);
    }

    return true;
}

// ============== PRINT SCALE RECOMMENDER ==============

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

let globalPrintZoomBias = 1.0; // Steers overall zoom across the app (1.0 = neutral)

/**
 * Adjust overall print zoom bias globally.
 * Typical range: 0.75 – 1.5. Values > 1 zoom in more across all maps.
 */
export function setPrintZoomBias(bias: number) {
    if (!Number.isFinite(bias)) return;
    globalPrintZoomBias = clamp(bias, 0.5, 3);
}

export function getPrintZoomBias(): number {
    return globalPrintZoomBias;
}

/**
 * Recommend a multiplier to apply on top of the best-fit scale for printing.
 * The multiplier depends on the content area relative to the page area so that
 * smaller maps are scaled up more and larger maps less.
 *
 * This function does NOT compute the fit scale itself; it outputs a multiplier
 * you can apply to your own base fit scale calculation. Ensure you also account
 * for margins when computing your base fit scale.
 */
export function recommendPrintScaleMultiplier(
    markdown: string,
    options?: {
        pageWidthPx?: number;     // default A4 portrait width at 96dpi (~794)
        pageHeightPx?: number;    // default A4 portrait height at 96dpi (~1123)
        marginPx?: number;        // margin on each side subtracted from page for fit
        minMultiplier?: number;   // floor for multiplier
        maxMultiplier?: number;   // ceiling for multiplier
        zoomBias?: number;        // additional bias applied on top of global bias
    }
): number {
    const bounds = getFullMindMapBounds(markdown);
    if (!bounds) return 1.0;

    const pageWidth = options?.pageWidthPx ?? 794;  // 8.27in * 96
    const pageHeight = options?.pageHeightPx ?? 1123; // 11.69in * 96
    const margin = options?.marginPx ?? 24;
    const effectivePageWidth = Math.max(1, pageWidth - margin * 2);
    const effectivePageHeight = Math.max(1, pageHeight - margin * 2);

    // Content size including the renderer padding used during layout
    const contentWidth = bounds.width + PADDING * 2 + margin * 2;
    const contentHeight = bounds.height + PADDING * 2 + margin * 2;

    // Relative coverage of the page area
    const contentArea = contentWidth * contentHeight;
    const pageArea = effectivePageWidth * effectivePageHeight;
    let areaRatio = contentArea / pageArea;
    if (!Number.isFinite(areaRatio)) areaRatio = 1;
    areaRatio = clamp(areaRatio, 0, 2); // allow up to 200% to soften behavior when very large

    // Map area ratio to a multiplier range using a smooth curve.
    // Smaller area -> closer to maxMultiplier; Larger area -> closer to minMultiplier.
    const minMul = options?.minMultiplier ?? 1.05;
    const maxMul = options?.maxMultiplier ?? 2.2;
    const t = Math.sqrt(clamp(areaRatio, 0, 1)); // emphasize differences for small maps
    const base = maxMul - (maxMul - minMul) * t; // decreasing with size

    // Apply global and local bias and clamp to bounds
    const bias = clamp(options?.zoomBias ?? 1.0, 0.5, 3) * globalPrintZoomBias;
    return clamp(base * bias, minMul, maxMul);
}
