'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Share2, UploadCloud, Zap, FileUp } from 'lucide-react';
import FlashcardIcon from '@/components/FlashcardIcon';
import Generator from '@/components/Generator';
import Link from 'next/link';
import CogniGuideLogo from '../CogniGuide_logo.png';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import AuthModal from '@/components/AuthModal';

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
    <div ref={viewportRef} className="map-viewport h-full w-full !bg-transparent cursor-grab active:cursor-grabbing">
      <div ref={containerRef} id="mindmap-container"></div>
    </div>
  );
};


export default function Home() {
  const [showAuth, setShowAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const init = async () => {
      const { data } = await supabase.auth.getUser();
      const authed = Boolean(data.user);
      setIsAuthed(authed);
    };
    init();
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const signedIn = Boolean(session);
      setIsAuthed(signedIn);
      if (signedIn) {
        setShowAuth(false);
        router.push('/dashboard');
      }
    });
    return () => { sub.subscription.unsubscribe(); };
  }, [router]);

  const handleScrollToGenerator = () => {
    document.getElementById('generator')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>
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
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40rem] h-[40rem] bg-primary/10 rounded-full blur-3xl -z-10"></div>
            <div className="container relative z-10">
              <h1 className="text-4xl md:text-6xl font-extrabold font-heading tracking-tighter mb-6 leading-tight">
                From Notes to Mind Maps & Flashcards.
                <br />
                <span className="text-primary">Instantly, with AI.</span>
              </h1>
              <p className="max-w-3xl mx-auto text-lg md:text-xl text-muted-foreground mb-10">
                Stop drowning in dense documents and complex textbooks. CogniGuide’s AI analyzes your study materials and generates clear, interactive mind maps and adaptive flashcards that use an advanced spaced repetition algorithm. Helping you learn faster and remember longer.
              </p>
              <button 
                onClick={handleScrollToGenerator}
                className="group flex items-center justify-center gap-2 mx-auto px-8 py-3 text-base font-bold text-white bg-primary rounded-full shadow-lg shadow-primary/20 hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
              >
                <Zap className="h-5 w-5 transition-transform group-hover:-rotate-12" />
                Open Generator
              </button>
            </div>
          </section>

          {/* Why Mind Maps Section */}
          <section className="py-20 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">The Science of Smarter Learning</h2>
                <p className="text-muted-foreground mt-3 max-w-3xl mx-auto">CogniGuide integrates two powerful, research-backed learning methods. Visual mind maps help you grasp the big picture, while our intelligent Spaced Repetition flashcards lock knowledge into your long-term memory.</p>
              </div>
              <div className="relative bg-white rounded-[2rem] border shadow-xl shadow-slate-200/50 overflow-hidden">
                <div className="h-[500px] md:h-[600px] w-full">
                  <InteractiveMindMap />
                </div>
              </div>
            </div>
          </section>

          <Generator redirectOnAuth />

          {/* How It Works Section */}
          <section className="py-20 bg-muted/30 border-y">
            <div className="container">
              <div className="text-center mb-16">
                <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight">From Chaos to Clarity in 3 Simple Steps</h2>
              </div>
              <div className="relative max-w-4xl mx-auto">
                <div className="absolute top-1/2 left-0 w-full h-px bg-border -translate-y-1/2 hidden md:block"></div>
                <div className="relative grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                  
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white mb-6 border-4 border-muted/30 ring-4 ring-primary/20">
                      <span className="text-xl font-bold">1</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border">
                      <UploadCloud className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Upload or Prompt</h3>
                      <p className="text-muted-foreground text-sm">Provide a document (PDF, DOCX, etc.), an image, or simply describe your topic.</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center">
                     <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white mb-6 border-4 border-muted/30 ring-4 ring-primary/20">
                      <span className="text-xl font-bold">2</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border">
                      <Zap className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">AI Generation</h3>
                      <p className="text-muted-foreground text-sm">Our AI analyzes your content, extracts key concepts, and builds your learning tools in seconds.</p>
                    </div>
                  </div>

                  <div className="flex flex-col items-center">
                     <div className="flex items-center justify-center h-12 w-12 rounded-full bg-primary text-white mb-6 border-4 border-muted/30 ring-4 ring-primary/20">
                      <span className="text-xl font-bold">3</span>
                    </div>
                    <div className="p-6 bg-background rounded-[1.25rem] shadow-md border">
                      <Share2 className="h-8 w-8 text-primary mx-auto mb-3" />
                      <h3 className="text-xl font-bold font-heading mb-2">Learn & Retain</h3>
                      <p className="text-muted-foreground text-sm">Interact with your mind map, study with flashcards, and export your materials in multiple formats.</p>
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
              <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                 <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileUp className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Versatile Document Support</h3>
                    <p className="text-muted-foreground text-sm mt-1">Supports PDF, DOCX, PPTX, TXT files and images, extracting key information automatically.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Zap className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Deep AI Analysis</h3>
                    <p className="text-muted-foreground text-sm mt-1">Goes beyond summarization to create logical, hierarchical mind maps.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
                  <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FlashcardIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-bold font-heading text-lg">Intelligent Spaced Repetition</h3>
                    <p className="text-muted-foreground text-sm mt-1">Master your subjects with flashcards that adapt to you. Our spaced repetition system schedules reviews at the right time to move information from short-term to long-term memory, ensuring you never forget.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4 p-6 bg-background rounded-[1.25rem] border hover:border-primary/50 hover:shadow-lg transition-all">
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

          {/* Final CTA Section */}
          <section className="py-20">
            <div className="container">
              <div className="relative text-center bg-primary/10 rounded-[2rem] p-10 md:p-16 overflow-hidden">
                <div className="absolute top-0 left-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <h2 className="text-3xl md:text-4xl font-bold font-heading tracking-tight text-primary">Ready to Revolutionize Your Learning?</h2>
                    <p className="max-w-xl mx-auto text-muted-foreground mt-4 mb-8">Stop wasting time with inefficient study methods. Start creating, learning, and retaining with the power of AI today.</p>
                    <button 
                      onClick={handleScrollToGenerator}
                      className="group flex items-center justify-center gap-2 mx-auto px-8 py-3 text-base font-bold text-white bg-primary rounded-full shadow-lg shadow-primary/30 hover:bg-primary/90 transition-all duration-300 ease-in-out transform hover:scale-105"
                    >
                      <Zap className="h-5 w-5 transition-transform group-hover:-rotate-12" />
                      Get Started Now
                    </button>
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
