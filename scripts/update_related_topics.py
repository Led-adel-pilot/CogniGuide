#!/usr/bin/env python3
"""Update internal related topic links for generated flashcard or mind map pages.

This script replaces placeholder related topic links (`/` and `/flashcards`)
with data-driven interlinks based on topical similarity and each page's
`linkingRecommendations`. It ensures every affected page links to at least
two relevant peers and that no page is left without inbound recommendations.
"""

from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Sequence, Set, Tuple


DEFAULT_SOURCE = Path("lib/programmatic/generated/flashcardPages.ts")
CONTENT_TYPES = {
    "flashcards": {
        "source": DEFAULT_SOURCE,
        "placeholders": {"/", "/flashcards"},
        "base_path": "/flashcards",
    },
    "mindmaps": {
        "source": Path("lib/programmatic/generated/mindMapPages.ts"),
        "placeholders": {"/", "/mind-maps"},
        "base_path": "/mind-maps",
    },
}
MIN_LINKS = 2
MAX_LINKS = 3

# Common words that do not help determine topical similarity.
STOPWORDS = {
    "a",
    "about",
    "active",
    "ai",
    "any",
    "app",
    "apps",
    "are",
    "best",
    "better",
    "build",
    "built",
    "by",
    "can",
    "card",
    "cards",
    "comprehensive",
    "content",
    "create",
    "created",
    "creating",
    "creates",
    "digital",
    "docx",
    "easy",
    "efficient",
    "effortless",
    "effective",
    "exam",
    "exams",
    "fast",
    "flashcard",
    "flashcards",
    "focus",
    "for",
    "free",
    "from",
    "generator",
    "generators",
    "generating",
    "generate",
    "generated",
    "helps",
    "how",
    "improve",
    "instantly",
    "into",
    "learn",
    "learning",
    "make",
    "making",
    "master",
    "mastery",
    "map",
    "mapping",
    "maps",
    "mind",
    "mindmap",
    "mindmaps",
    "notes",
    "online",
    "pdf",
    "platform",
    "powerpoint",
    "prep",
    "quick",
    "seamless",
    "set",
    "sets",
    "simple",
    "smart",
    "spaced",
    "study",
    "studies",
    "studying",
    "system",
    "systems",
    "tool",
    "tools",
    "ultimate",
    "upload",
    "uploads",
    "using",
    "with",
    "your",
}


@dataclass
class PageContext:
    """Pre-computed context for a single programmatic page."""

    slug: str
    path: str
    linking_anchor: str
    linking_descriptions: Sequence[str]
    tokens: Sequence[str]
    keyword_phrases: Sequence[str]
    slug_tokens: Sequence[str]


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Replace placeholder related topic links with data-driven interlinks."
    )
    parser.add_argument(
        "--content-type",
        choices=sorted(CONTENT_TYPES.keys()),
        default="flashcards",
        help="Select which programmatic landings to process (default: %(default)s).",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=None,
        help="Path to generated pages file (defaults depend on --content-type).",
    )
    parser.add_argument(
        "--min-links",
        type=int,
        default=MIN_LINKS,
        help="Minimum links per page (default: %(default)s).",
    )
    parser.add_argument(
        "--max-links",
        type=int,
        default=MAX_LINKS,
        help="Maximum links per page (default: %(default)s).",
    )
    return parser.parse_args()


def load_pages(path: Path) -> Tuple[str, int, int, List[Dict]]:
    """Load the JSON array embedded in the generated TypeScript file."""
    text = path.read_text(encoding="utf-8")
    assign_idx = text.index("=")
    start_idx = text.index("[", assign_idx)
    end_idx = text.rfind("]")

    page_objects = json.loads(text[start_idx : end_idx + 1])
    return text, start_idx, end_idx, page_objects


def tokenize(value: str) -> List[str]:
    """Return significant lowercase tokens from freeform text."""
    tokens = re.findall(r"[a-z0-9]+", value.lower())
    return [token for token in tokens if token not in STOPWORDS]


def build_page_contexts(pages: Sequence[Dict], base_path: str = "") -> List[PageContext]:
    contexts: List[PageContext] = []
    for page in pages:
        metadata = page.get("metadata", {})
        keywords = metadata.get("keywords") or []
        keyword_phrases = [phrase.lower() for phrase in keywords]

        tokens = set()
        tokens.update(tokenize(metadata.get("title", "")))
        tokens.update(tokenize(page.get("slug", "")))

        linking = page.get("linkingRecommendations") or {}
        anchor_text = linking.get("anchorText", metadata.get("title", "")).strip()
        description_variants = linking.get("descriptionVariants") or [
            metadata.get("description", "").strip()
        ]

        tokens.update(tokenize(anchor_text))
        for desc in description_variants:
            tokens.update(tokenize(desc or ""))
        for phrase in keyword_phrases:
            tokens.update(tokenize(phrase))

        embedded_mindmap = page.get("embeddedMindMap")
        if isinstance(embedded_mindmap, dict):
            markdown = embedded_mindmap.get("markdown")
            if isinstance(markdown, str):
                tokens.update(tokenize(markdown))

        path_value = (page.get("path") or "").strip()
        slug = (page.get("slug") or "").strip()
        if not path_value and base_path and slug:
            path_value = f"{base_path.rstrip('/')}/{slug}"

        contexts.append(
            PageContext(
                slug=slug,
                path=path_value,
                linking_anchor=anchor_text,
                linking_descriptions=tuple(desc for desc in description_variants if desc),
                tokens=tuple(tokens),
                keyword_phrases=tuple(keyword_phrases),
                slug_tokens=tuple(token for token in slug.split("-") if token),
            )
        )
    return contexts


def jaccard_score(tokens_a: Sequence[str], tokens_b: Sequence[str]) -> float:
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    return len(intersection) / len(union) if union else 0.0


def similarity_score(contexts: Sequence[PageContext], idx_a: int, idx_b: int) -> float:
    ctx_a = contexts[idx_a]
    ctx_b = contexts[idx_b]

    keyword_overlap = len(set(ctx_a.keyword_phrases) & set(ctx_b.keyword_phrases))
    slug_overlap = len(set(ctx_a.slug_tokens) & set(ctx_b.slug_tokens))
    jaccard = jaccard_score(ctx_a.tokens, ctx_b.tokens)

    # Weighted combination prioritizing exact keyword phrase overlap.
    return jaccard + 0.6 * keyword_overlap + 0.3 * slug_overlap


def select_related_targets(
    contexts: Sequence[PageContext],
    placeholder_indices: Sequence[int],
    min_links: int,
    max_links: int,
) -> Dict[int, List[int]]:
    """Determine related pages for each placeholder page."""
    similarity_cache: Dict[Tuple[int, int], float] = {}

    def score(a: int, b: int) -> float:
        key = (min(a, b), max(a, b))
        if key not in similarity_cache:
            similarity_cache[key] = similarity_score(contexts, a, b)
        return similarity_cache[key]

    selections: Dict[int, List[int]] = {}
    candidate_pool = set(placeholder_indices)
    candidate_map: Dict[int, List[Tuple[float, int]]] = {}

    for idx in placeholder_indices:
        candidates: List[Tuple[float, int]] = []
        for other in candidate_pool:
            if other == idx:
                continue
            candidates.append((score(idx, other), other))

        candidates.sort(key=lambda item: item[0], reverse=True)
        candidate_map[idx] = candidates

        chosen: List[int] = []
        for similarity, other in candidates:
            if other in chosen:
                continue
            if similarity <= 0.0 and len(chosen) >= min_links:
                continue
            chosen.append(other)
            if len(chosen) >= max_links:
                break

        if len(chosen) < min_links:
            for _, other in candidates:
                if other not in chosen:
                    chosen.append(other)
                if len(chosen) >= min_links:
                    break

        selections[idx] = chosen

    inbound = defaultdict(int)
    for targets in selections.values():
        for target in targets:
            if target in candidate_pool:
                inbound[target] += 1

    orphans = [idx for idx in placeholder_indices if inbound[idx] == 0]

    for orphan in orphans:
        candidates = candidate_map.get(orphan, [])
        if not candidates:
            continue

        _, best_partner = candidates[0]
        partner_links = selections[best_partner]

        if orphan not in partner_links:
            if len(partner_links) < max_links:
                partner_links.append(orphan)
            else:
                partner_links.sort(key=lambda other: score(best_partner, other))
                lowest = partner_links[0]
                if score(best_partner, orphan) >= score(best_partner, lowest):
                    partner_links[0] = orphan
                    if lowest in candidate_pool:
                        inbound[lowest] = max(0, inbound[lowest] - 1)

        if orphan in candidate_pool:
            inbound[orphan] += 1

    for origin, targets in selections.items():
        targets.sort(key=lambda other: score(origin, other), reverse=True)
        selections[origin] = targets[:max_links]

        if len(selections[origin]) < min_links:
            needed = min_links - len(selections[origin])
            extras = [
                other
                for _, other in candidate_map.get(origin, [])
                if other not in selections[origin] and other != origin
            ][:needed]
            selections[origin].extend(extras)

    return selections


def build_link_entries(
    pages: Sequence[Dict], contexts: Sequence[PageContext], selections: Dict[int, List[int]]
) -> Dict[int, List[Dict]]:
    link_map: Dict[int, List[Dict]] = {}

    for origin_idx, target_indices in selections.items():
        links: List[Dict] = []
        for offset, target_idx in enumerate(target_indices):
            target_page = pages[target_idx]
            target_ctx = contexts[target_idx]

            variants = target_ctx.linking_descriptions or (
                target_page.get("metadata", {}).get("description", ""),
            )
            description = variants[offset % len(variants)].strip()

            links.append(
                {
                    "label": target_ctx.linking_anchor,
                    "href": target_ctx.path,
                    "description": description,
                }
            )
        link_map[origin_idx] = links

    return link_map


def replace_related_links(
    pages: List[Dict], link_map: Dict[int, List[Dict]], placeholder_indices: Sequence[int]
) -> int:
    updated_count = 0
    for idx in placeholder_indices:
        if idx not in link_map:
            continue
        page = pages[idx]
        related_section = page.get("relatedTopicsSection") or {}
        related_section["links"] = link_map[idx]
        page["relatedTopicsSection"] = related_section
        updated_count += 1
    return updated_count


def write_pages(path: Path, original_text: str, start: int, end: int, pages: Sequence[Dict]) -> None:
    json_payload = json.dumps(pages, indent=2, ensure_ascii=False)
    new_text = f"{original_text[:start]}{json_payload}{original_text[end + 1 :]}"
    path.write_text(new_text, encoding="utf-8")


def find_placeholder_indices(pages: Sequence[Dict], placeholders: Set[str]) -> List[int]:
    indices: List[int] = []
    for idx, page in enumerate(pages):
        links = (page.get("relatedTopicsSection") or {}).get("links") or []
        if any(
            link.get("href") in placeholders or link.get("label") in placeholders
            for link in links
        ):
            indices.append(idx)
    return indices


def main() -> None:
    args = parse_arguments()
    content_config = CONTENT_TYPES.get(args.content_type, CONTENT_TYPES["flashcards"])
    source_path = args.source or content_config["source"]
    placeholders = set(content_config["placeholders"])
    base_path = content_config["base_path"]

    original_text, start_idx, end_idx, pages = load_pages(source_path)

    placeholder_indices = find_placeholder_indices(pages, placeholders)
    if not placeholder_indices:
        print("No placeholder related topic links found; nothing to update.")
        return

    contexts = build_page_contexts(pages, base_path)
    selections = select_related_targets(
        contexts, placeholder_indices, args.min_links, args.max_links
    )
    link_map = build_link_entries(pages, contexts, selections)

    updated = replace_related_links(pages, link_map, placeholder_indices)
    write_pages(source_path, original_text, start_idx, end_idx, pages)

    print(f"Updated relatedTopicsSection links for {updated} pages.")


if __name__ == "__main__":
    main()
