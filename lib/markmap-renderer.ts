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
    color: string | null;
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

export interface InitializeOptions {
    initialPanXOffset?: number;
    initialPanYOffset?: number;
    disableInteractions?: boolean;
}

interface RgbColor { r: number; g: number; b: number; }
interface HslColor { h: number; s: number; l: number; }

// ============== CONSTANTS ==============

const HORIZONTAL_SPACING = 150;
const VERTICAL_SPACING = 10;
const PADDING = 50;
const ANIMATION_DURATION = 300;

// Light Mode Color Palette
const L_NODE_COLOR_PALETTE = [
    'hsla(12, 56%, 92%, 1.00)',
    'hsla(83, 56%, 92%, 1.00)',
    'hsla(26, 56%, 92%, 1.00)',
    'hsla(206, 56%, 92%, 1.00)',
    'hsla(154, 56%, 92%, 1.00)',
    'hsla(342, 56%, 92%, 1.00)',
    'hsla(284, 56%, 92%, 1.00)',
    'hsla(54, 71%, 92%, 1.00)',
    'hsla(9, 54%, 95%, 1.00)'
];
const L_TEXT_COLOR_PALETTE = [
    'hsla(04, 65%, 45%, 1.00)',
    'hsla(83, 82%, 35%, 1.00)',
    'hsla(37, 90%, 39%, 1.00)',
    'hsla(208, 82%, 39%, 1.00)',
    'hsla(162, 82%, 35%, 1.00)',
    'hsla(341, 70%, 39%, 1.00)',
    'hsla(285, 70%, 39%, 1.00)',
    'hsla(54, 85%, 41%, 1.00)',
    'hsla(354, 82%, 39%, 1.00)'
];

// Dark Mode Color Palette
const D_NODE_COLOR_PALETTE = [
    'hsla(12, 56%, 22%, 1.00)',
    'hsla(83, 56%, 22%, 1.00)',
    'hsla(26, 56%, 22%, 1.00)',
    'hsla(206, 56%, 22%, 1.00)',
    'hsla(154, 56%, 22%, 1.00)',
    'hsla(342, 56%, 22%, 1.00)',
    'hsla(284, 56%, 22%, 1.00)',
    'hsla(54, 71%, 22%, 1.00)',
    'hsla(9, 54%, 25%, 1.00)'
];
const D_TEXT_COLOR_PALETTE = [
    'hsla(04, 65%, 85%, 1.00)',
    'hsla(83, 82%, 85%, 1.00)',
    'hsla(37, 90%, 85%, 1.00)',
    'hsla(208, 82%, 85%, 1.00)',
    'hsla(162, 82%, 85%, 1.00)',
    'hsla(341, 70%, 85%, 1.00)',
    'hsla(285, 70%, 85%, 1.00)',
    'hsla(54, 85%, 85%, 1.00)',
    'hsla(354, 82%, 85%, 1.00)'
];

// Dynamically select palette based on dark mode media query
const isDarkMode = () => {
    // 1. Check for theme override from the app's theme toggle
    const appTheme = document.documentElement.dataset.theme;
    if (appTheme === 'dark') return true;
    if (appTheme === 'light') return false;
    // 2. Fallback to system preference
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
};
const getNodeColorPalette = () => isDarkMode() ? D_NODE_COLOR_PALETTE : L_NODE_COLOR_PALETTE;
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
let userHasInteracted = false; // Track if user has manually panned or zoomed
let themeObserver: MutationObserver | null = null;
// Mouse panning state
let isPanning = false, startX = 0, startY = 0;
// Touch gesture state
let isPinching = false, initialDistance = 0;
let lastTouchX = 0, lastTouchY = 0; // For single-finger panning
// Transform animation state
let transformAnimationToken = 0;

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
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
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
        .replace(/`([^`]+)`/g, '<code>$1</code>');
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
    if (node.color && childrenWithSubtrees.length >= 2) {
        const n = childrenWithSubtrees.length;
        const HUE_VARIATION = 0.03;
        const baseColor = node.color;
        const baseTextColor = node.textColor ?? (baseColor ? darkenColor(baseColor, 70) : null);
        childrenWithSubtrees.forEach((childNode, index) => {
            const variationStep = n === 1 ? 0 : (index / (n - 1)) * 2 - 1;
            const hueShift = HUE_VARIATION * variationStep;
            const variedColor = varyHue(baseColor, hueShift);
            const variedTextColor = baseTextColor ? varyHue(baseTextColor, hueShift) : null;
            function setSubtreeStyle(subtreeNode: MindMapNode, color: string, textColor: string | null) {
                subtreeNode.color = color;
                if (textColor) subtreeNode.textColor = textColor;
                subtreeNode.children.forEach(child => setSubtreeStyle(child, color, textColor));
            }
            setSubtreeStyle(childNode, variedColor, variedTextColor);
        });
    }
    node.children.forEach(applyColorVariations);
}

function parseMarkmap(markdown: string): MindMapNode {
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
    const rootBaseColor = isDarkMode() ? 'hsla(214, 56%, 23%, 1.00)' : 'hsla(206, 56%, 92%, 1.00)';
    const rootTextColor = isDarkMode() ? 'hsla(213, 82%, 85%, 1.00)' : 'hsla(208, 82%, 39%, 1.00)';
    const root: MindMapNode = {
        id: 'node-0', text: rootText, html: renderMarkdownToHTML(rootText),
        children: [], level: 0, isRoot: true, color: rootBaseColor, textColor: rootTextColor, parent: null,
        width: 0, height: 0, x: 0, y: 0
    };
    const parentStack = [root];
    let lastHeadingLevel = 0;
    for (const line of lines) {
        if (line.trim() === '') continue;
        let isFolded = false;
        let processedLine = line;
        if (line.includes('<!-- markmap: fold -->')) {
            isFolded = true;
            processedLine = line.replace('<!-- markmap: fold -->', '');
        }
        const headingMatch = processedLine.match(/^(#+)\s(.*)/);
        const listItemMatch = processedLine.match(/^(\s*)(\*|-|\d+\.)\s(.*)/);
        let text, level;
        if (headingMatch) {
            level = headingMatch[1].length;
            text = headingMatch[2].trim();
            // Make level 3 and 4 headings bold
            if (level === 3 || level === 4) {
                text = `**${text}**`;
            }
            lastHeadingLevel = level;
        } else if (listItemMatch) {
            text = listItemMatch[3].trim();
            // Treat leading ###/#### in list items as bold markers and strip them from display
            const pseudoHeading = text.match(/^#{3,4}\s+(.*)$/);
            if (pseudoHeading) {
                text = `**${pseudoHeading[1].trim()}**`;
            }
            const indent = getIndent(listItemMatch[1]);
            level = lastHeadingLevel + 1 + Math.floor(indent / 2);
        } else {
            continue;
        }
        while (parentStack[parentStack.length - 1].level >= level) {
            parentStack.pop();
        }
        const parent = parentStack[parentStack.length - 1];
        let nodeColor: string | null;
        let nodeTextColor: string | null;
        if (parent.isRoot) {
            const NODE_COLOR_PALETTE = getNodeColorPalette();
            const TEXT_COLOR_PALETTE = getTextColorPalette();
            const idx = colorIndex++ % NODE_COLOR_PALETTE.length;
            nodeColor = NODE_COLOR_PALETTE[idx];
            nodeTextColor = TEXT_COLOR_PALETTE[idx] ?? darkenColor(nodeColor, 70);
        } else {
            nodeColor = parent.color;
            nodeTextColor = parent.textColor ?? (nodeColor ? darkenColor(nodeColor, 70) : null);
        }
        const newNode: MindMapNode = {
            id: `node-${nodeCounter++}`, text: text, html: renderMarkdownToHTML(text),
            children: [],
            // Only collapse if explicitly folded in markdown
            isCollapsed: isFolded,
            level: level,
            parent: parent,
            color: nodeColor,
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

    scale = Math.min(scaleX, scaleY, 2); // Cap max zoom

    const contentCenterX = bounds.minX + PADDING + bounds.width / 2;
    const contentCenterY = bounds.minY + PADDING + bounds.height / 2;

    panX = (viewportWidth / 2) - (contentCenterX * scale);
    panY = (viewportHeight / 2) - (contentCenterY * scale);

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

// Immediate (non-animated) fit to the CURRENT rendered tree state
function autoFitToCurrentTreeImmediate() {
    if (!viewport || !mindMapTree) return;

    const bounds = getTreeBounds(mindMapTree);
    if (!bounds || bounds.width === 0 || bounds.height === 0) return;

    const viewportWidth = viewport.clientWidth;
    const viewportHeight = viewport.clientHeight;

    // Use same effective size as animated fit for consistency
    const effectiveWidth = viewportWidth * 0.7;
    const effectiveHeight = viewportHeight * 0.7;

    const contentWidth = bounds.width + PADDING * 2;
    const contentHeight = bounds.height + PADDING * 2;

    const scaleX = effectiveWidth / contentWidth;
    const scaleY = effectiveHeight / contentHeight;

    const targetScale = Math.min(scaleX, scaleY, 2);

    const contentCenterX = bounds.minX + PADDING + bounds.width / 2;
    const contentCenterY = bounds.minY + PADDING + bounds.height / 2;

    const targetPanX = (viewportWidth / 2) - (contentCenterX * targetScale);
    const targetPanY = (viewportHeight / 2) - (contentCenterY * targetScale);

    scale = targetScale;
    panX = targetPanX;
    panY = targetPanY;
    applyTransform();
    stableRootY = mindMapTree.y;
}


function measureNodeSizes(node: MindMapNode) {
    const tempNode = document.createElement('div');
    tempNode.className = 'mindmap-node';
    if (node.isRoot) tempNode.classList.add('root');
    tempNode.style.visibility = 'hidden';
    tempNode.style.position = 'absolute';
    tempNode.innerHTML = node.html;
    document.body.appendChild(tempNode);
    // Assuming KaTeX is available globally if needed
    if ((window as any).renderMathInElement) {
        (window as any).renderMathInElement(tempNode, {
            delimiters: [
                {left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    }
    node.width = tempNode.offsetWidth;
    node.height = tempNode.offsetHeight;
    document.body.removeChild(tempNode);
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

function drawConnector(parent: MindMapNode, child: MindMapNode, svgEl: SVGSVGElement, xOffset: number, yOffset: number, isExpanding: boolean): SVGPathElement {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'connector-path');
    // Match connector color to the node's text color for visual consistency
    const connectorStroke = child.textColor ?? (child.color ? darkenColor(child.color, 70) : '#000000');
    path.style.stroke = connectorStroke;
    const p1 = { x: parent.x + parent.width + xOffset, y: parent.y + parent.height / 2 + yOffset };
    const p2 = { x: child.x + xOffset, y: child.y + child.height / 2 + yOffset };
    const d = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p1.x) / 2} ${p1.y}, ${p1.x + (p2.x - p1.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`;
    path.setAttribute('d', d);
    svgEl.appendChild(path);

    // Prepare stroke-dash animation for aesthetic draw-in effect
    try {
        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        if (isExpanding) {
            path.style.opacity = '0';
            path.style.strokeDashoffset = `${length}`;
            // Use two RAFs to ensure styles are applied before transition starts
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    path.style.opacity = '1';
                    path.style.strokeDashoffset = '0';
                });
            });
        } else {
            // Fully drawn by default
            path.style.strokeDashoffset = '0';
        }
    } catch {
        // getTotalLength can throw for invalid paths; ignore and leave as-is
    }

    return path;
}

function renderNodeAndChildren(node: MindMapNode, container: HTMLElement, svgEl: SVGSVGElement, xOffset: number, yOffset: number, isPartOfExpandingSubtree = false) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'mindmap-node';
    nodeEl.id = node.id;
    nodeEl.innerHTML = node.html;
    if ((window as any).renderMathInElement) {
        (window as any).renderMathInElement(nodeEl, {
            delimiters: [
                {left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false},
                {left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true}
            ],
            throwOnError: false
        });
    }
    
    const shouldAnimateIn = isPartOfExpandingSubtree;

    if (shouldAnimateIn) {
        nodeEl.style.left = `${node.parent!.x + xOffset}px`;
        nodeEl.style.top = `${node.parent!.y + yOffset}px`;
        nodeEl.style.opacity = '0';
        nodeEl.style.transform = 'scale(0.5)';
    } else {
        nodeEl.style.left = `${node.x + xOffset}px`;
        nodeEl.style.top = `${node.y + yOffset}px`;
    }
    
    if (node.color) {
        const borderColor = node.textColor ?? saturateColor(darkenColor(node.color, 25), 60);
        nodeEl.style.backgroundColor = node.color;
        nodeEl.style.borderColor = borderColor;
        nodeEl.style.color = node.textColor ?? darkenColor(node.color, 70);
        nodeEl.style.setProperty('--indicator-border-color', borderColor);
        nodeEl.style.setProperty('--collapsed-indicator-color', node.color);
    }
    if (node.isRoot) {
        nodeEl.classList.add('root');
        // Use explicit text color if provided, otherwise derive from background
        nodeEl.style.color = node.textColor ?? darkenColor(node.color || '#b5d9ffff', 70);
    }
    if (node.children.length > 0) nodeEl.classList.add('has-children');
    if (node.isCollapsed) nodeEl.classList.add('collapsed');
    
    nodeEl.addEventListener('click', (e) => {
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
    
    container.appendChild(nodeEl);

    if (shouldAnimateIn) {
        requestAnimationFrame(() => {
            nodeEl.style.left = `${node.x + xOffset}px`;
            nodeEl.style.top = `${node.y + yOffset}px`;
            nodeEl.style.opacity = '1';
            nodeEl.style.transform = 'scale(1)';
            setTimeout(() => {
                nodeEl.style.transform = '';
            }, ANIMATION_DURATION);
        });
    }

    if (node.parent) {
        node.connectorPath = drawConnector(node.parent, node, svgEl, xOffset, yOffset, shouldAnimateIn);
    }

    if (!node.isCollapsed) {
        const childrenAreExpanding = node.isExpanding || isPartOfExpandingSubtree;
        node.children.forEach(child => renderNodeAndChildren(child, container, svgEl, xOffset, yOffset, childrenAreExpanding));
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
            if (isDescendant) descendantNodes.push(n);
            if (!n.isCollapsed || n === node) {
                n.children.forEach(child => traverse(child, isDescendant || n === node));
            }
        }
        traverse(mindMapTree!);

        // Set node to collapsed and recalculate layout for final positions.
        node.isCollapsed = true;
        layoutTree(mindMapTree!, 0, 0);

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

        // Animate all nodes to their new positions using CSS transitions
        allNodes.forEach(n => {
            const el = document.getElementById(n.id);
            if (!el) return;

            const isDescendant = descendantNodes.includes(n);
            
            // For descendants, target is the collapsed node's final position.
            // For other nodes, target is their own new position calculated by layoutTree.
            const targetX = isDescendant ? node.x : n.x;
            const targetY = isDescendant ? node.y : n.y;

            el.style.left = `${targetX + PADDING}px`;
            el.style.top = `${targetY + PADDING}px`;

            if (isDescendant) {
                el.style.opacity = '0';
                el.style.transform = 'scale(0.5)';
            }

            // Animate connectors
            const pathEl = n.connectorPath;
            if (pathEl && n.parent) {
                const parent = n.parent;
                // A parent of a descendant can either be another descendant or the node being collapsed.
                const parentIsDescendant = descendantNodes.includes(parent);
                const parentTargetX = parentIsDescendant ? node.x : parent.x;
                const parentTargetY = parentIsDescendant ? node.y : parent.y;

                const p1 = { x: parentTargetX + parent.width + PADDING, y: parentTargetY + parent.height / 2 + PADDING };
                const p2 = { x: targetX + PADDING, y: targetY + n.height / 2 + PADDING };
                const d = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p1.x) / 2} ${p1.y}, ${p1.x + (p2.x - p1.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`;
                
                // Update path shape immediately
                pathEl.setAttribute('d', d);

                try {
                    const length = pathEl.getTotalLength();
                    if (isDescendant) {
                        // Only descendants erase; keep remaining connected path morphing smoothly
                        pathEl.style.strokeDasharray = `${length}`;
                        pathEl.style.strokeDashoffset = '0';
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                pathEl.style.strokeDashoffset = `${length}`;
                                pathEl.style.opacity = '0';
                            });
                        });
                    } else {
                        // Do not use dash trick for non-descendants; rely on CSS 'd' transition to morph
                        pathEl.style.removeProperty('stroke-dasharray');
                        pathEl.style.removeProperty('stroke-dashoffset');
                        pathEl.style.opacity = '1';
                    }
                } catch {
                    if (isDescendant) {
                        pathEl.style.opacity = '0';
                    }
                }
            }
        });

        // After animation, rerender to clean up the DOM
        setTimeout(() => {
            node.isAnimating = false;
            rerenderMindMap();
        }, ANIMATION_DURATION);
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
    renderNodeAndChildren(mindMapTree, mapContainer, svg, PADDING, PADDING, false);
    
    const bounds = getTreeBounds(mindMapTree);
    mapContainer.style.width = `${bounds.width + 2 * PADDING}px`;
    mapContainer.style.height = `${bounds.maxY + 2 * PADDING}px`;
    svg.setAttribute('width', mapContainer.style.width);
    svg.setAttribute('height', mapContainer.style.height);
}

// ============== EVENT HANDLERS ==============

function handleWheel(e: WheelEvent) {
    e.preventDefault();
    userHasInteracted = true;
    // Cancel ongoing transform animation on user interaction
    transformAnimationToken++;
    const zoomSpeed = 0.1;
    const oldScale = scale;
    const rect = getViewportRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    if (e.deltaY < 0) {
        scale = Math.min(scale + zoomSpeed, 5);
    } else {
        scale = Math.max(0.1, scale - zoomSpeed);
    }
    panX = mouseX - (mouseX - panX) * (scale / oldScale);
    panY = mouseY - (mouseY - panY) * (scale / oldScale);
    bumpContainerWillChange();
    requestTransformUpdate();
}

function handleDarkModeChange() {
    // Rerender only if theme is 'system'
    const appTheme = document.documentElement.dataset.theme;
    if (appTheme === 'system' || !appTheme) {
        rerenderMindMap();
    }
}

function handleMouseDown(e: MouseEvent) {
    if ((e.target as HTMLElement).closest('.mindmap-node')) return;
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
    if (!isPanning) return;
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
    if ((e.target as HTMLElement).closest('.mindmap-node')) return;
    e.preventDefault();
    userHasInteracted = true;
    // Cancel ongoing transform animation on user interaction
    transformAnimationToken++;

    if (e.touches.length === 2) {
        isPinching = true;
        isPanning = false; // Ensure mouse panning is off
        initialDistance = getDistance(e.touches);
    } else if (e.touches.length === 1) {
        isPanning = true;
        isPinching = false;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
    }
}

function handleTouchMove(e: TouchEvent) {
    if (!isPanning && !isPinching) return;
    e.preventDefault();

    if (isPinching && e.touches.length === 2) { // Zooming
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

    } else if (isPanning && e.touches.length === 1) { // Panning
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
    if (e.touches.length < 2) isPinching = false;
    if (e.touches.length < 1) isPanning = false;
}

// ============== PUBLIC API ==============

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

    // Clean up previous event listeners
    cleanup();

    try {
        mindMapTree = parseMarkmap(markdown);
        // Apply color variations only to children of the root, not the root itself
        mindMapTree.children.forEach(child => applyColorVariations(child));
        rerenderMindMap();
        autoFitView(markdown);

        // Attach event listeners (unless disabled)
        if (!options?.disableInteractions) {
            viewport.addEventListener('wheel', handleWheel, { passive: false });
            viewport.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('mousemove', handleMouseMove);
            // Add touch event listeners for mobile
            viewport.addEventListener('touchstart', handleTouchStart, { passive: false });
            viewport.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleTouchEnd);
            // Listen for dark mode changes
            window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handleDarkModeChange);
            // Keep cached viewport rect valid on resize
            window.addEventListener('resize', invalidateViewportRect, { passive: true });

            // Observe data-theme attribute changes on <html> to react to theme toggle
            themeObserver = new MutationObserver(() => {
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
            try {
                // Fallback: enforce collapse for any immediate child that still isn't collapsed
                if (mindMapTree) {
                    mindMapTree.children.forEach((child) => {
                        if (child.children.length > 0 && !child.isCollapsed) {
                            child.isCollapsed = true;
                        }
                    });
                }
                rerenderMindMap();
            } catch {}
            autoFitToCurrentTree();
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
    try {
        rerenderMindMap();
    } catch {}
    autoFitToCurrentTree();
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
    }
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
