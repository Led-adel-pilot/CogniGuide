'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Share2, UploadCloud, Zap, FileUp } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import Dropzone from '@/components/Dropzone';
import PromptForm from '@/components/PromptForm';
import MindMapModal from '@/components/MindMapModal';
import FlashcardsModal, { Flashcard as FlashcardType } from '@/components/FlashcardsModal';
import AuthModal from '@/components/AuthModal';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import CogniGuideLogo from '../CogniGuide_logo.png';

const InteractiveMindMap = () => {
  const viewportRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const mapContainer = containerRef.current;

    if (!viewport || !mapContainer) {
      return;
    }

    // --- Start of embedded script logic ---
    const HORIZONTAL_SPACING = 150;
    const VERTICAL_SPACING = 10;
    const PADDING = 50;
    const ANIMATION_DURATION = 350;
    const INITIAL_PAN_X_OFFSET = -400; // Positive moves right, negative moves left
    const INITIAL_PAN_Y_OFFSET = 46; // Positive moves down, negative moves up
    const COLOR_PALETTE = ['#e2b8ff', '#fcf76bff', '#acff97', '#ffbc97', '#8cbdfeff', '#ff944dff', '#ffc2d1', '#bde0fe', '#a1ccff', '#f6a6b3'];
    
    type MindMapNode = {
        id: string;
        text: string;
        html: string;
        children: MindMapNode[];
        level: number;
        isRoot: boolean;
        color: string;
        parent: MindMapNode | null;
        width: number;
        height: number;
        x: number;
        y: number;
        isCollapsed: boolean;
        connectorPath?: any;
        isAnimating?: boolean;
        isExpanding?: boolean;
    };

    let mindMapTree: MindMapNode | null = null, stableRootY: number | null = null, svg: SVGSVGElement | null = null;
    let scale = 1, panX = 0, panY = 0, isPanning = false, startX = 0, startY = 0;

    function hexToRgb(hex: string) {
        if (!hex) return { r: 0, g: 0, b: 0 };
        let r = 0, g = 0, b = 0;
        if (hex.startsWith('#')) {
            r = parseInt(hex.slice(1, 3), 16);
            g = parseInt(hex.slice(3, 5), 16);
            b = parseInt(hex.slice(5, 7), 16);
        }
        return { r, g, b };
    }
    function rgbToHex(r: number, g: number, b: number) { return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).padStart(6, '0')}`; }
    function rgbToHsl(r: number, g: number, b: number) {
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
    function hslToRgb(h: number, s: number, l: number) {
        let r, g, b;
        if (s === 0) { r = g = b = l; }
        else {
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
    function varyHue(color: string, amount: number) {
        const { r, g, b } = hexToRgb(color);
        let { h, s, l } = rgbToHsl(r, g, b);
        h = (h + amount + 1) % 1;
        const { r: newR, g: newG, b: newB } = hslToRgb(h, s, l);
        return rgbToHex(newR, newG, newB);
    }
    function varyLightness(color: string, amount: number) {
        const { r, g, b } = hexToRgb(color);
        let { h, s, l } = rgbToHsl(r, g, b);
        l = Math.max(0, Math.min(1, l + amount));
        const { r: newR, g: newG, b: newB } = hslToRgb(h, s, l);
        return rgbToHex(newR, newG, newB);
    }
    function darkenColor(color: string, percent: number) {
        if (!color) return '#000000';
        let { r, g, b } = hexToRgb(color);
        const amount = 1 - percent / 100;
        r = Math.floor(r * amount);
        g = Math.floor(g * amount);
        b = Math.floor(b * amount);
        return rgbToHex(r, g, b);
    }
    function saturateColor(color: string, percent: number) {
        if (!color) return '#000000';
        let { r, g, b } = hexToRgb(color);
        let { h, s, l } = rgbToHsl(r, g, b);
        s = Math.min(1, s * (1 + percent / 100));
        const { r: newR, g: newG, b: newB } = hslToRgb(h, s, l);
        return rgbToHex(newR, newG, newB);
    }
    function renderMarkdownToHTML(text: string) {
        return text
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" onclick="event.stopPropagation()">$1</a>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/__(.*?)__/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/_(.*?)_/g, '<em>$1</em>')
            .replace(/~~(.*?)~~/g, '<del>$1</del>').replace(/==(.*?)==/g, '<mark>$1</mark>')
            .replace(/\`([^\`]+)\`/g, '<code>$1</code>');
    }
    function parseFrontmatter(markdown: string) {
        const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
        if (!match) return { frontmatter: {}, content: markdown };
        const frontmatter: {[key: string]: string} = {};
        const yaml = match[1];
        yaml.split('\n').forEach(line => {
            const parts = line.split(':');
            if (parts.length >= 2) { frontmatter[parts[0].trim()] = parts.slice(1).join(':').trim(); }
        });
        return { frontmatter, content: markdown.substring(match[0].length) };
    }
    function applyColorVariations(node: MindMapNode) {
        const childrenWithSubtrees = node.children.filter((child: MindMapNode) => child.children.length > 0);
        if (node.color && childrenWithSubtrees.length >= 2) {
            const n = childrenWithSubtrees.length;
            const HUE_VARIATION = 0.03, LIGHTNESS_VARIATION = 0.02;
            const baseColor = node.color;
            childrenWithSubtrees.forEach((childNode: MindMapNode, index: number) => {
                const variationStep = n === 1 ? 0 : (index / (n - 1)) * 2 - 1;
                const hueShift = HUE_VARIATION * variationStep;
                const lightnessShift = LIGHTNESS_VARIATION * variationStep * (index % 2 === 0 ? 1 : -1);
                let variedColor = varyHue(baseColor, hueShift);
                variedColor = varyLightness(variedColor, lightnessShift);
                function setSubtreeColor(subtreeNode: MindMapNode, color: string) {
                    subtreeNode.color = color;
                    subtreeNode.children.forEach((child: MindMapNode) => setSubtreeColor(child, color));
                }
                setSubtreeColor(childNode, variedColor);
            });
        }
        node.children.forEach(applyColorVariations);
    }
    function parseMarkmap(markdown: string) {
        const { frontmatter, content } = parseFrontmatter(markdown);
        let lines = content.split('\n');
        const getIndent = (line: string) => (line.match(/^\s*/) || [''])[0].length;
        let nodeCounter = 1, colorIndex = 0;
        let rootText = frontmatter.title || "Mind Map";
        const h1Index = lines.findIndex(line => line.trim().startsWith('# '));
        if (h1Index !== -1) {
            rootText = lines[h1Index].trim().substring(2);
            lines.splice(h1Index, 1);
        }
        const root: MindMapNode = { id: 'node-0', text: rootText, html: renderMarkdownToHTML(rootText), children: [], level: 0, isRoot: true, color: '#8cb8fe', parent: null, width: 0, height: 0, x: 0, y: 0, isCollapsed: false };
        const parentStack: MindMapNode[] = [root];
        let lastHeadingLevel = 0;
        for (const line of lines) {
            if (line.trim() === '') continue;
            let isFolded = false;
            let processedLine = line.replace('<!-- markmap: fold -->', () => { isFolded = true; return ''; });
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
                // Support pseudo-headings inside list items like "### Title" or "#### Title"
                const pseudoHeading = text.match(/^#{3,4}\s+(.*)$/);
                if (pseudoHeading) {
                    text = `**${pseudoHeading[1].trim()}**`;
                }
                const indent = getIndent(listItemMatch[1]);
                level = lastHeadingLevel + 1 + Math.floor(indent / 2);
            } else continue;
            while (parentStack[parentStack.length - 1].level >= level) { parentStack.pop(); }
            const parent = parentStack[parentStack.length - 1];
            let nodeColor = parent.isRoot ? COLOR_PALETTE[colorIndex++ % COLOR_PALETTE.length] : parent.color;
            const newNode: MindMapNode = { id: `node-${nodeCounter++}`, text, html: renderMarkdownToHTML(text), children: [], isCollapsed: isFolded, level, parent, color: nodeColor, width: 0, height: 0, x: 0, y: 0, isRoot: false };
            parent.children.push(newNode);
            parentStack.push(newNode);
        }
        return root;
    }
    function applyTransform() { if (mapContainer) mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`; }
    function measureNodeSizes(node: MindMapNode) {
        const tempNode = document.createElement('div');
        tempNode.className = 'mindmap-node';
        if (node.isRoot) tempNode.classList.add('root');
        tempNode.style.cssText = 'visibility:hidden; position:absolute;';
        tempNode.innerHTML = node.html;
        document.body.appendChild(tempNode);
        if ((window as any).renderMathInElement) (window as any).renderMathInElement(tempNode, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true}], throwOnError: false });
        node.width = tempNode.offsetWidth;
        node.height = tempNode.offsetHeight;
        document.body.removeChild(tempNode);
        if (!node.isCollapsed) node.children.forEach(measureNodeSizes);
    }
    function layoutTree(node: MindMapNode, x: number, y: number): number {
        node.x = x; node.y = y;
        if (node.isCollapsed || node.children.length === 0) return node.height;
        let currentChildY = y;
        node.children.forEach((child: MindMapNode, index: number) => {
            const childSubtreeHeight = layoutTree(child, x + node.width + HORIZONTAL_SPACING, currentChildY);
            currentChildY += childSubtreeHeight + (index < node.children.length - 1 ? VERTICAL_SPACING : 0);
        });
        const totalChildHeight = currentChildY - y;
        const firstChild = node.children[0];
        const lastChild = node.children[node.children.length - 1];
        node.y = firstChild.y + (lastChild.y + lastChild.height - firstChild.y) / 2 - (node.height / 2);
        return Math.max(node.height, totalChildHeight);
    }
    function getTreeBounds(node: MindMapNode) {
        let minX = node.x, maxX = node.x + node.width, minY = node.y, maxY = node.y + node.height;
        function traverse(n: MindMapNode) {
            minX = Math.min(minX, n.x); maxX = Math.max(maxX, n.x + n.width);
            minY = Math.min(minY, n.y); maxY = Math.max(maxY, n.y + n.height);
            if (!n.isCollapsed) n.children.forEach(traverse);
        }
        traverse(node);
        return { width: maxX - minX, height: maxY - minY, minY, maxY };
    }
    function drawConnector(parent: MindMapNode, child: MindMapNode, svgEl: SVGSVGElement, xOffset: number, yOffset: number, isExpanding: boolean) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connector-path');
        if (isExpanding) { path.style.opacity = '0'; requestAnimationFrame(() => { path.style.opacity = '1'; }); }
        if (child.color) path.style.stroke = saturateColor(darkenColor(child.color, 25), 60);
        const p1 = { x: parent.x + parent.width + xOffset, y: parent.y + parent.height / 2 + yOffset };
        const p2 = { x: child.x + xOffset, y: child.y + child.height / 2 + yOffset };
        const d = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p1.x) / 2} ${p1.y}, ${p1.x + (p2.x - p1.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`;
        path.setAttribute('d', d);
        svgEl.appendChild(path);
        return path;
    }
    function renderNodeAndChildren(node: MindMapNode, container: HTMLElement, svgEl: SVGSVGElement, xOffset: number, yOffset: number, isPartOfExpandingSubtree = false) {
        const nodeEl = document.createElement('div');
        nodeEl.className = 'mindmap-node';
        nodeEl.id = node.id;
        nodeEl.innerHTML = node.html;
        if ((window as any).renderMathInElement) (window as any).renderMathInElement(nodeEl, { delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}, {left: '\\(', right: '\\)', display: false}, {left: '\\[', right: '\\]', display: true}], throwOnError: false });
        const shouldAnimateIn = isPartOfExpandingSubtree;
        if (shouldAnimateIn && node.parent) {
            nodeEl.style.left = `${node.parent.x + xOffset}px`;
            nodeEl.style.top = `${node.parent.y + yOffset}px`;
            nodeEl.style.opacity = '0';
            nodeEl.style.transform = 'scale(0.5)';
        } else {
            nodeEl.style.left = `${node.x + xOffset}px`;
            nodeEl.style.top = `${node.y + yOffset}px`;
        }
        if (node.color) {
            const borderColor = saturateColor(darkenColor(node.color, 25), 60);
            nodeEl.style.backgroundColor = node.color;
            nodeEl.style.borderColor = borderColor;
            nodeEl.style.color = darkenColor(node.color, 70);
            nodeEl.style.setProperty('--indicator-border-color', borderColor);
            nodeEl.style.setProperty('--collapsed-indicator-color', node.color);
        }
        if (node.isRoot) {
            nodeEl.classList.add('root');
            nodeEl.style.color = darkenColor(node.color || '#b5d9ffff', 70);
        }
        if (node.children.length > 0) nodeEl.classList.add('has-children');
        if (node.isCollapsed) nodeEl.classList.add('collapsed');
        nodeEl.addEventListener('click', (e) => {
            if ((e.target as HTMLElement).tagName.toLowerCase() === 'a') return;
            const selection = window.getSelection();
            if (selection && !selection.isCollapsed && selection.anchorNode && nodeEl.contains(selection.anchorNode)) {
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
                setTimeout(() => { nodeEl.style.transform = ''; }, ANIMATION_DURATION);
            });
        }
        if (node.parent) node.connectorPath = drawConnector(node.parent, node, svgEl, xOffset, yOffset, shouldAnimateIn);
        if (!node.isCollapsed) {
            const childrenAreExpanding = node.isExpanding || isPartOfExpandingSubtree;
            node.children.forEach((child: MindMapNode) => renderNodeAndChildren(child, container, svgEl, xOffset, yOffset, childrenAreExpanding));
        }
    }
    function toggleNodeCollapse(node: MindMapNode) {
        if (node.isAnimating) return;
        node.isAnimating = true;
        if (node.isCollapsed) {
            node.isCollapsed = false;
            node.isExpanding = true;
            rerenderMindMap();
            setTimeout(() => { delete node.isExpanding; node.isAnimating = false; }, ANIMATION_DURATION);
        } else {
            const allNodes: MindMapNode[] = [], descendantNodes: MindMapNode[] = [];
            function traverse(n: MindMapNode, isDescendant = false) {
                allNodes.push(n);
                if (isDescendant) descendantNodes.push(n);
                if (!n.isCollapsed || n === node) n.children.forEach((child: MindMapNode) => traverse(child, isDescendant || n === node));
            }
            if (mindMapTree) {
                traverse(mindMapTree);
                node.isCollapsed = true;
                layoutTree(mindMapTree, 0, 0);
                const newRootY = mindMapTree.y;
                if (stableRootY !== null) {
                    const deltaY = newRootY - stableRootY;
                    if (deltaY !== 0) { panY -= deltaY * scale; applyTransform(); }
                }
                stableRootY = newRootY;
            }
            allNodes.forEach(n => {
                const el = document.getElementById(n.id);
                if (!el) return;
                const isDescendant = descendantNodes.includes(n);
                const targetX = isDescendant ? node.x : n.x;
                const targetY = isDescendant ? node.y : n.y;
                el.style.left = `${targetX + PADDING}px`;
                el.style.top = `${targetY + PADDING}px`;
                if (isDescendant) { el.style.opacity = '0'; el.style.transform = 'scale(0.5)'; }
                if (n.connectorPath && n.parent) {
                    const parent = n.parent;
                    const parentIsDescendant = descendantNodes.includes(parent);
                    const parentTargetX = parentIsDescendant ? node.x : parent.x;
                    const parentTargetY = parentIsDescendant ? node.y : parent.y;
                    const p1 = { x: parentTargetX + parent.width + PADDING, y: parentTargetY + parent.height / 2 + PADDING };
                    const p2 = { x: targetX + PADDING, y: targetY + n.height / 2 + PADDING };
                    const d = `M ${p1.x} ${p1.y} C ${p1.x + (p2.x - p1.x) / 2} ${p1.y}, ${p1.x + (p2.x - p1.x) / 2} ${p2.y}, ${p2.x} ${p2.y}`;
                    n.connectorPath.setAttribute('d', d);
                    if (isDescendant) n.connectorPath.style.opacity = '0';
                }
            });
            setTimeout(() => { node.isAnimating = false; rerenderMindMap(); }, ANIMATION_DURATION);
        }
    }
    function rerenderMindMap() {
        if (!mindMapTree || !mapContainer || !viewport) return;
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
            // Add your constants to the end of the calculation
            panX = (viewport.clientWidth / 2 - rootNodeCenterXInLayout) + INITIAL_PAN_X_OFFSET;
            panY = (viewport.clientHeight / 2 - rootNodeCenterYInLayout) + INITIAL_PAN_Y_OFFSET;
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
    function handleMouseDown(e: MouseEvent) {
        if ((e.target as HTMLElement).closest('.mindmap-node')) return;
        e.preventDefault();
        isPanning = true;
        startX = e.clientX - panX;
        startY = e.clientY - panY;
    }
    function handleMouseUp() { isPanning = false; }
    function handleMouseMove(e: MouseEvent) {
        if (!isPanning) return;
        panX = e.clientX - startX;
        panY = e.clientY - startY;
        applyTransform();
    }
    function initializeMindMap(markdown: string, targetViewport: HTMLElement, targetContainer: HTMLElement) {
        scale = 0.87; panX = 0; panY = 0; stableRootY = null;
        cleanup(); 
        try {
            mindMapTree = parseMarkmap(markdown);
            if (mindMapTree) {
                mindMapTree.children.forEach((child: MindMapNode) => applyColorVariations(child));
            }
            rerenderMindMap();
            targetViewport.addEventListener('mousedown', handleMouseDown);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('mousemove', handleMouseMove);
        } catch (error) {
            console.error("Error rendering mind map:", error);
            targetContainer.innerHTML = `<div class="error">Failed to render mind map.</div>`;
        }
    }
    function cleanup() {
        if (viewport) {
            viewport.removeEventListener('mousedown', handleMouseDown as EventListener);
        }
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('mousemove', handleMouseMove);
    }
    
    const markdownData = "# CogniGuide 🧠🗺️\n- **The Problem: Drowning in Text 😩**\n  - Dense, complex documents 📚\n  - Time-consuming reading ⏳\n  - Poor knowledge retention 📉\n- **Our Solution: The Ultimate AI Tool 🤖**\n  - Exceptional Accuracy in analysis 🎯\n  - Transforms any text into a mind map 🗺️\n  - Automatically extracts key insights 🔑\n  - Effortlessly grasp complex topics ✅\n- **Science-Backed Efficiency 🔬**\n  - Faster comprehension ⚡\n  - Boost long-term recall 🧠💾\n  - Enhances creative thinking & problem-solving 🤔\n- **Powerful Features & Benefits ✨**\n  - **Save Dozens of Hours** per week ⏰\n  - **Achieve Higher Grades** & better outcomes 🏆\n  - **Accelerate Your Research** & learning ⚡";
    
    initializeMindMap(markdownData, viewport, mapContainer);

    return () => {
      cleanup();
    };
  }, []);

  return (
    <div ref={viewportRef} className="map-viewport h-[500px] md:h-[600px] w-full !bg-transparent cursor-grab active:cursor-grabbing">
      <div ref={containerRef} id="mindmap-container"></div>
    </div>
  );
};


export default function Home() {
  const [files, setFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [mode, setMode] = useState<'mindmap' | 'flashcards'>('mindmap');
  const [flashcardsOpen, setFlashcardsOpen] = useState(false);
  const [flashcardsTitle, setFlashcardsTitle] = useState<string | null>(null);
  const [flashcardsCards, setFlashcardsCards] = useState<FlashcardType[] | null>(null);
  const [flashcardsError, setFlashcardsError] = useState<string | null>(null);
  const [flashcardsDeckId, setFlashcardsDeckId] = useState<string | undefined>(undefined);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
      setUserId(data.user ? data.user.id : null);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      setUserId(session?.user?.id ?? null);
      if (signedIn) {
        setShowAuth(false);
        router.push('/dashboard');
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router]);

  const handleFileChange = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    setError(null);
  };

  const handleSubmit = async () => {
    if (mode === 'flashcards') {
      // Require at least one file for file-based flashcards generation
      if (files.length === 0) {
        setError('Please upload at least one file to generate flashcards.');
        return;
      }

      // Require authentication for all generations
      if (!isAuthed) {
        setShowAuth(true);
        return;
      }

      setIsLoading(true);
      setError(null);
      setMarkdown(null);
      setFlashcardsError(null);
      setFlashcardsCards(null);
      setFlashcardsTitle(null);

      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      if (prompt.trim()) formData.append('prompt', prompt.trim());

      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        const res = await fetch('/api/generate-flashcards?stream=1', {
          method: 'POST',
          body: formData,
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        });
        // Handle insufficient credits the same way as mind maps: show inline error and do not open modal
        if (res.status === 402) {
          let msg = 'Insufficient credits. Please upgrade your plan or top up.';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        if (!res.ok) {
          let msg = 'Failed to generate flashcards';
          try { const j = await res.json(); msg = j?.error || msg; } catch {}
          setError(msg);
          setIsLoading(false);
          return;
        }
        // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
        if (isAuthed) {
          try {
            const { data } = await supabase.auth.getUser();
            const uid = data.user?.id;
            if (uid) {
              const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
              const creditsVal = Number(creditsData?.credits ?? 0);
              const display = Number.isFinite(creditsVal) ? creditsVal.toFixed(1) : '0.0';
              if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsVal, display } }));
            }
          } catch {}
        }
        // Open modal only after successful response
        setFlashcardsOpen(true);

        if (!res.body) {
          const data = await res.json().catch(() => null);
          const cards = Array.isArray(data?.cards) ? data.cards as FlashcardType[] : [];
          if (cards.length === 0) throw new Error('No cards generated');
          setFlashcardsCards(cards);
          setFlashcardsTitle(typeof data?.title === 'string' ? data.title : null);
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (typeof data?.title === 'string' && data.title.trim()) ? data.title.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setFlashcardsDeckId((ins as any).id as string);
              }
            } catch {}
          }
        } else {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          let streamedTitle: string | null = null;
          const accumulated: FlashcardType[] = [];
          // eslint-disable-next-line no-constant-condition
          while (true) {
            // eslint-disable-next-line no-await-in-loop
            const { value, done } = await reader.read();
            if (done) break;
            if (value) buf += decoder.decode(value, { stream: true });
            let nl;
            while ((nl = buf.indexOf('\n')) !== -1) {
              const rawLine = buf.slice(0, nl).trim();
              buf = buf.slice(nl + 1);
              if (!rawLine) continue;
              try {
                const obj = JSON.parse(rawLine);
                if (obj?.type === 'meta') {
                  if (typeof obj.title === 'string' && obj.title.trim()) streamedTitle = obj.title.trim();
                } else if (obj?.type === 'card') {
                  const card: FlashcardType = {
                    question: String(obj.question || ''),
                    answer: String(obj.answer || ''),
                    tags: Array.isArray(obj.tags) ? obj.tags.map((t: any) => String(t)) : undefined,
                  };
                  accumulated.push(card);
                  setFlashcardsCards((prev) => prev ? [...prev, card] : [card]);
                }
              } catch {
                // ignore malformed lines
              }
            }
          }
          setFlashcardsTitle(streamedTitle);
          if (accumulated.length === 0) throw new Error('No cards generated');
          // Persist generated flashcards for authenticated users and set deck id for SR persistence
          if (isAuthed && userId) {
            try {
              const titleToSave = (streamedTitle && streamedTitle.trim()) ? streamedTitle.trim() : 'flashcards';
              const { data: ins, error: insErr } = await supabase
                .from('flashcards')
                .insert({ user_id: userId, title: titleToSave, markdown: '', cards: accumulated })
                .select('id')
                .single();
              if (!insErr && (ins as any)?.id) {
                setFlashcardsDeckId((ins as any).id as string);
              }
            } catch {}
          }
        }

        if (!isAuthed) { setShowAuth(true); }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to generate flashcards.';
        console.error(errorMessage);
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (files.length === 0 && !prompt.trim()) {
      setError('Please upload at least one file or enter a text prompt to generate a mind map.');
      return;
    }

    // Require authentication for all generations
    if (!isAuthed) {
      setShowAuth(true);
      return;
    }

    setIsLoading(true);
    setError(null);
    setMarkdown(null);

    const formData = new FormData();
    if (files.length > 0) {
      files.forEach(file => {
        formData.append('files', file);
      });
    }
    if (prompt.trim()) formData.append('prompt', prompt.trim());

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token;
      const response = await fetch('/api/generate-mindmap', {
        method: 'POST',
        body: formData,
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        if (contentType.includes('application/json')) {
          let errorMsg = 'Failed to generate mind map.';
          try { const j = await response.json(); errorMsg = j.error || errorMsg; } catch {}
          throw new Error(errorMsg);
        } else {
          throw new Error('Failed to generate mind map.');
        }
      }
      // Deduction occurs server-side at start; if signed in, refresh credits and notify listeners
      if (isAuthed) {
        try {
          const { data } = await supabase.auth.getUser();
          const uid = data.user?.id;
          if (uid) {
            const { data: creditsData } = await supabase.from('user_credits').select('credits').eq('user_id', uid).single();
            const creditsVal = Number(creditsData?.credits ?? 0);
            const display = Number.isFinite(creditsVal) ? creditsVal.toFixed(1) : '0.0';
            if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cogniguide:credits-updated', { detail: { credits: creditsVal, display } }));
          }
        } catch {}
      }
      if (!contentType.includes('text/plain')) {
        // Non-stream fallback
        const result = await response.json();
        const md = (result?.markdown as string | undefined)?.trim();
        if (!md) throw new Error('Empty result from AI.');
        setMarkdown(md);
        if (isAuthed && userId) {
          const title = (() => {
            const h1 = md.match(/^#\s(.*)/m)?.[1];
            if (h1) return h1;
            const fm = md.match(/title:\s*(.*)/)?.[1];
            if (fm) return fm;
            return 'mindmap';
          })();
          try { await supabase.from('mindmaps').insert({ user_id: userId, title, markdown: md }); } catch {}
        }
        if (!isAuthed) { setShowAuth(true); }
        return;
      }
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';
      let receivedAny = false;
      if (!reader) throw new Error('No response stream.');
      // Open modal immediately on first token
      const pump = async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (!chunk) continue;
          accumulated += chunk;
          if (!receivedAny && accumulated.trim().length > 0) {
            receivedAny = true;
          }
          setMarkdown(accumulated);
        }
      };
      await pump();

      const md = accumulated.trim();
      if (!md) throw new Error('Empty result from AI.');

      // Save for authed users after stream completes
      if (isAuthed && userId) {
        const title = (() => {
          const h1 = md.match(/^#\s(.*)/m)?.[1];
          if (h1) return h1;
          const fm = md.match(/title:\s*(.*)/)?.[1];
          if (fm) return fm;
          return 'mindmap';
        })();
        try { await supabase.from('mindmaps').insert({ user_id: userId, title, markdown: md }); } catch {}
      }
      // Require sign-in for all generations
      if (!isAuthed) {
        setShowAuth(true);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate mind map.';
      console.error(errorMessage);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseModal = () => setMarkdown(null);
  const handleCloseFlashcards = () => { setFlashcardsOpen(false); setFlashcardsCards(null); setFlashcardsError(null); setFlashcardsDeckId(undefined); };
  const handleScrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
  };
  const handleUpgradeClick = () => {
    try {
      if (isAuthed) {
        router.push('/dashboard?upgrade=true');
      } else {
        if (typeof window !== 'undefined') {
          localStorage.setItem('cogniguide_upgrade_flow', 'true');
        }
        router.push('/pricing');
      }
    } catch {}
  };

  const isDisabled = isLoading || markdown !== null || flashcardsOpen;

  return (
    <>
      <MindMapModal markdown={markdown} onClose={handleCloseModal} />
      <FlashcardsModal open={flashcardsOpen} title={flashcardsTitle} cards={flashcardsCards} isGenerating={isLoading && mode==='flashcards'} error={flashcardsError} onClose={handleCloseFlashcards} deckId={flashcardsDeckId} />
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} />
      <div className="flex flex-col min-h-screen font-sans bg-background text-foreground">
        
        <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Image src={CogniGuideLogo} alt="CogniGuide Logo" width={40} height={40} className="h-10 w-10 text-primary" />
              <h1 className="text-2xl font-bold font-heading tracking-tighter">CogniGuide</h1>
            </div>
            <div className="flex items-center gap-2">
              {isAuthed ? (
                <>
                  <button onClick={() => router.push('/dashboard')} className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Dashboard</button>
                </>
              ) : (
                <button onClick={() => setShowAuth(true)} className="px-4 py-2 text-sm rounded-full border hover:bg-gray-50">Sign in</button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1">
          {/* Hero Section */}
          <section className="relative text-center py-20 md:py-32 overflow-hidden">
            <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
            <div className="container relative z-10">
              <h1 className="text-4xl md:text-6xl font-extrabold font-heading tracking-tighter mb-6 leading-tight">
                From Notes to Mind Maps & Flashcards.
                <br />
                <span className="text-primary">Instantly, with AI.</span>
              </h1>
              <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
                Stop drowning in dense documents and complex textbooks. CogniGuide’s AI analyzes your study materials and generates clear, interactive mind maps and adaptive flashcards that use an advanced spaced repetition algorithm. Helping you learn faster and remember longer.              </p>
              <button 
                onClick={handleScrollToGenerator}
                className="flex items-center justify-center gap-2 mx-auto px-8 py-2 text-base font-bold text-white bg-primary rounded-full shadow-2xl shadow-primary/30 hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
              >
                <Zap className="h-6 w-6" />
                Open Generator
              </button>
            </div>
          </section>

          {/* Why Mind Maps Section */}
          <section className="py-20 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">The Science of Smarter Learning</h2>
                <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">CogniGuide integrates two powerful, research-backed learning methods. Visual mind maps help you grasp the big picture and connect ideas, while our intelligent Spaced Repetition flashcards ensure knowledge is locked into your long-term memory. It's the most effective way to learn.</p>
              </div>
              <InteractiveMindMap />
            </div>
          </section>

          {/* Generator Section */}
          <section id="generator" className="py-20">
            <div className="container">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">Generate Mind Map or Flashcards</h2>
                <p className="text-muted-foreground mt-2">Upload a document or simply describe your topic. Choose your output.</p>
              </div>
              <div className="relative w-full max-w-3xl mx-auto bg-background rounded-[2rem] border border-border/20 shadow-[0_0_16px_rgba(0,0,0,0.12)] hover:shadow-[0_0_20px_rgba(0,0,0,0.16)] transition-shadow duration-300">
                <div className="absolute -top-2 -left-2 w-24 h-24 bg-primary/10 rounded-full blur-2xl -z-10"></div>
                <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-accent/10 rounded-full blur-3xl -z-10"></div>
                <div className="p-6 sm:p-8 space-y-6">
                  <div className="flex items-center justify-center">
                    <div className="inline-flex p-1 rounded-full border bg-white">
                      <button
                        onClick={() => setMode('mindmap')}
                        className={`px-4 py-1.5 text-sm rounded-full ${mode==='mindmap' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                      >Mind Map</button>
                      <button
                        onClick={() => setMode('flashcards')}
                        className={`px-4 py-1.5 text-sm rounded-full ${mode==='flashcards' ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-50'}`}
                      >Flashcards</button>
                    </div>
                  </div>
                  <Dropzone onFileChange={handleFileChange} disabled={isDisabled} />
                  <PromptForm
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                    prompt={prompt}
                    setPrompt={setPrompt}
                    disabled={isDisabled}
                    filesLength={files.length}
                    ctaLabel={mode==='flashcards' ? 'Generate Flashcards' : 'Generate Mind Map'}
                  />                  
                  {error && (
                    <div className="mt-4 text-center p-3 bg-blue-100/50 border border-blue-400/50 text-blue-700 rounded-[1rem]">
                      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                        <p className="sm:mr-2">{error}</p>
                        {typeof error === 'string' && error.toLowerCase().includes('insufficient credits') && (
                          <button
                            type="button"
                            onClick={handleUpgradeClick}
                            className="px-4 py-1.5 text-sm rounded-full bg-primary text-white hover:bg-primary/90"
                          >
                            Upgrade Plan
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="py-20 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">From Chaos to Clarity in Seconds</h2>
              </div>
              <div className="relative">
                <div className="space-y-16 md:space-y-0 md:grid grid-cols-3 gap-8">
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary text-white mb-4 border-4 border-background shadow-lg">
                      <span className="text-2xl font-bold">1</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border border-border/10">
                      <UploadCloud className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Input</h3>
                      <p className="text-muted-foreground">Upload a document (PDF, DOCX, TXT) or type a prompt.</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary text-white mb-4 border-4 border-background shadow-lg">
                      <span className="text-2xl font-bold">2</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border border-border/10">
                      <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Generate</h3>
                      <p className="text-muted-foreground">Our AI analyzes your content, identifies key concepts, and builds a logical mind map and study‑ready flashcards in seconds.</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="flex items-center justify-center h-16 w-16 rounded-full bg-primary text-white mb-4 border-4 border-background shadow-lg">
                      <span className="text-2xl font-bold">3</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border border-border/10">
                      <Share2 className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Interact</h3>
                      <p className="text-muted-foreground">Explore your map and study with generated flashcards — download or save to your dashboard.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="py-20">
            <div className="container">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">An Intelligent Partner for Your Brain</h2>
                <p className="text-muted-foreground mt-2">Features designed to make you smarter, faster, and more creative.</p>
              </div>
              <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-8 max-w-4xl mx-auto">
                 <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border border-border/10">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Versatile Document Support</h3>
                    <p className="text-muted-foreground text-sm mt-1">Supports PDF, DOCX, PPTX, TXT files and images, extracting key information automatically.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border border-border/10">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Deep AI Analysis</h3>
                    <p className="text-muted-foreground text-sm mt-1">Goes beyond summarization to create logical, hierarchical mind maps.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border border-border/10">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FlashcardIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Intelligent Spaced Repetition</h3>
                    <p className="text-muted-foreground text-sm mt-1">Master your subjects with flashcards that adapt to you. Our spaced repetition system schedules reviews at the right time to move information from short-term to long-term memory, ensuring you never forget.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border border-border/10">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Instant Generation</h3>
                    <p className="text-muted-foreground text-sm mt-1">Save hours of manual work. Our AI processes content and builds maps in seconds, not minutes.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>

        <footer className="border-t">
          <div className="container py-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">&copy; {new Date().getFullYear()} CogniGuide. All rights reserved.</p>
            <nav className="flex flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/pricing" className="text-sm hover:underline">Pricing</Link>
              <Link href="/contact" className="text-sm hover:underline">Contact</Link>
              <Link href="/legal/refund-policy" className="text-sm hover:underline">Refund Policy</Link>
              <Link href="/legal/cancellation-policy" className="text-sm hover:underline">Cancellation Policy</Link>
              <Link href="/legal/terms" className="text-sm hover:underline">Terms of Service</Link>
            </nav>
          </div>
        </footer>

      </div>
    </>
  );
}
