#!/usr/bin/env python3
"""Assign and audit programmatic flashcard pages within the taxonomy.

This utility inspects the generated flashcard landing pages and the hub/subhub
taxonomy declared in ``data/flashcard_taxonomy.json``. Missing slugs are scored
against every subhub using lightweight lexical similarity heuristics and placed
with the best match. Ambiguous matches can be reported, reassigned, or routed to
an explicit fallback subhub for manual curation.

Heuristic highlights:
  * Overlapping keyword phrases and slug tokens carry extra weight.
  * Section copy (hero, features, SEO, FAQ, related topics) contribute to the
    token pool so specialised vocabulary is captured.
  * Numeric tokens are expanded into their word equivalents to cluster ranges
    (e.g. ``1-5`` → ``one``, ``five``).
"""

from __future__ import annotations

import argparse
import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Iterable, List, Mapping, MutableMapping, Optional, Sequence, Set, Tuple

DEFAULT_PAGES = Path("lib/programmatic/generated/flashcardPages.ts")
DEFAULT_TAXONOMY = Path("data/flashcard_taxonomy.json")

# Common words that add noise when comparing topical similarity.
STOPWORDS: Set[str] = {
    "a",
    "about",
    "active",
    "ai",
    "an",
    "and",
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
    "com",
    "comprehensive",
    "content",
    "create",
    "created",
    "creates",
    "creating",
    "creation",
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
    "generate",
    "generated",
    "generating",
    "how",
    "improve",
    "instant",
    "instantly",
    "into",
    "learn",
    "learning",
    "make",
    "making",
    "master",
    "mastery",
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

NUMBER_WORDS: Dict[str, str] = {
    "0": "zero",
    "1": "one",
    "2": "two",
    "3": "three",
    "4": "four",
    "5": "five",
    "6": "six",
    "7": "seven",
    "8": "eight",
    "9": "nine",
    "10": "ten",
    "11": "eleven",
    "12": "twelve",
    "13": "thirteen",
    "14": "fourteen",
    "15": "fifteen",
    "16": "sixteen",
    "17": "seventeen",
    "18": "eighteen",
    "19": "nineteen",
    "20": "twenty",
    "30": "thirty",
    "40": "forty",
    "50": "fifty",
    "60": "sixty",
    "70": "seventy",
    "80": "eighty",
    "90": "ninety",
    "100": "hundred",
    "1000": "thousand",
}


@dataclass
class PageContext:
    slug: str
    tokens: Set[str] = field(default_factory=set)
    keyword_phrases: Set[str] = field(default_factory=set)
    slug_tokens: Set[str] = field(default_factory=set)


@dataclass
class SubhubContext:
    hub_name: str
    subhub_name: str
    tokens: Set[str] = field(default_factory=set)
    keyword_phrases: Set[str] = field(default_factory=set)
    slug_tokens: Set[str] = field(default_factory=set)
    name_tokens: Set[str] = field(default_factory=set)
    hub_tokens: Set[str] = field(default_factory=set)
    slugs: List[str] = field(default_factory=list)


@dataclass
class AssignmentResult:
    slug: str
    target_hub: str
    target_subhub: str
    score: float
    runner_up: float
    gap: float
    fallback_used: bool
    reason: str = ""
    original_best: Optional[Tuple[str, str]] = None


@dataclass
class LowConfidenceEntry:
    slug: str
    hub: str
    subhub: str
    score: float
    runner_up: float
    gap: float
    best_key: Tuple[str, str]
    reason: str


def parse_arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Assign ungrouped flashcard pages to the most relevant taxonomy subhub."
    )
    parser.add_argument(
        "--pages",
        type=Path,
        default=DEFAULT_PAGES,
        help="Path to generated flashcard pages file (default: %(default)s).",
    )
    parser.add_argument(
        "--taxonomy",
        type=Path,
        default=DEFAULT_TAXONOMY,
        help="Path to hub/subhub taxonomy JSON (default: %(default)s).",
    )
    parser.add_argument(
        "--baseline-taxonomy",
        type=Path,
        help="Optional baseline taxonomy to help identify legacy assignments (e.g. committed version).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Compute assignments without modifying the taxonomy file.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Only process the first N missing slugs (useful for smoke testing).",
    )
    parser.add_argument(
        "--min-confidence",
        type=float,
        default=0.18,
        help="Minimum score before an assignment is considered confident (default: %(default)s).",
    )
    parser.add_argument(
        "--ambiguous-confidence",
        type=float,
        default=0.6,
        help="Upper bound to consider when checking for small gaps between the top matches (default: %(default)s).",
    )
    parser.add_argument(
        "--gap-threshold",
        type=float,
        default=0.02,
        help="Treat matches within this score gap as ties requiring review (default: %(default)s).",
    )
    parser.add_argument(
        "--fallback-min-confidence",
        type=float,
        default=0.08,
        help="Scores below this threshold are routed to the fallback subhub (default: %(default)s).",
    )
    parser.add_argument(
        "--fallback-hub",
        type=str,
        default="Vocabulary & Specialized Concepts",
        help="Hub to use for fallback assignments (default: %(default)s).",
    )
    parser.add_argument(
        "--fallback-subhub",
        type=str,
        default="General Concepts",
        help="Subhub to use for fallback assignments (default: %(default)s).",
    )
    parser.add_argument(
        "--report-existing",
        action="store_true",
        help="Only report low-confidence assignments without adding/removing slugs.",
    )
    parser.add_argument(
        "--report-output",
        type=Path,
        help="Optional path to write a JSON report for low-confidence assignments.",
    )
    parser.add_argument(
        "--reassign-low-confidence",
        action="store_true",
        help="Treat low-confidence slugs as missing so they are reassigned with improved heuristics.",
    )
    return parser.parse_args()


def load_pages(path: Path) -> Tuple[str, int, int, List[Dict]]:
    """Load the JSON array embedded in the generated TypeScript file."""
    text = path.read_text(encoding="utf-8")
    assign_idx = text.index("=")
    start_idx = text.index("[", assign_idx)
    end_idx = text.rfind("]")
    pages = json.loads(text[start_idx : end_idx + 1])
    return text, start_idx, end_idx, pages


def load_taxonomy(path: Path) -> Dict[str, Dict[str, List[str]]]:
    return json.loads(path.read_text(encoding="utf-8"))


def expand_numeric_token(token: str) -> Set[str]:
    pieces: Set[str] = set()
    if token in NUMBER_WORDS:
        pieces.add(NUMBER_WORDS[token])
    if token.isdigit() and len(token) > 1:
        for digit in token:
            if digit in NUMBER_WORDS:
                pieces.add(NUMBER_WORDS[digit])
    return pieces


def incorporate_token(target: Set[str], token: str) -> None:
    token = (token or "").strip().lower()
    if not token:
        return
    if token not in STOPWORDS:
        target.add(token)
    for piece in re.findall(r"[a-z]+|\d+", token):
        if piece and piece not in STOPWORDS:
            target.add(piece)
        target.update(expand_numeric_token(piece))
    target.update(expand_numeric_token(token))


def tokenize(value: str) -> List[str]:
    tokens = re.findall(r"[a-z0-9]+", value.lower())
    output: List[str] = []
    for token in tokens:
        if token in STOPWORDS:
            continue
        output.append(token)
    return output


def tokenize_slug(slug: str) -> List[str]:
    segments = re.split(r"[^a-z0-9]+", slug.lower())
    tokens: List[str] = []
    for segment in segments:
        if not segment:
            continue
        if segment in STOPWORDS:
            continue
        tokens.append(segment)
        for piece in re.findall(r"[a-z]+|\d+", segment):
            if piece and piece not in STOPWORDS:
                tokens.append(piece)
    return tokens


def extract_html_tokens(blocks: Sequence[Mapping]) -> Set[str]:
    tokens: Set[str] = set()
    for block in blocks:
        if not isinstance(block, Mapping):
            continue
        if block.get("type") == "paragraph":
            html = block.get("html")
            if isinstance(html, str):
                for token in tokenize(re.sub(r"<[^>]+>", " ", html)):
                    incorporate_token(tokens, token)
        elif block.get("type") == "list":
            items = block.get("items") or []
            for item in items:
                if isinstance(item, str):
                    for token in tokenize(re.sub(r"<[^>]+>", " ", item)):
                        incorporate_token(tokens, token)
    return tokens


def build_page_contexts(pages: Sequence[Dict]) -> Dict[str, PageContext]:
    contexts: Dict[str, PageContext] = {}

    for page in pages:
        slug = page.get("slug")
        if not slug:
            continue

        tokens: Set[str] = set()
        slug_tokens = set(tokenize_slug(slug))
        for token in slug_tokens:
            incorporate_token(tokens, token)

        keyword_phrases: Set[str] = set()

        metadata = page.get("metadata") or {}
        for key in ("title", "description"):
            value = metadata.get(key)
            if isinstance(value, str):
                for token in tokenize(value):
                    incorporate_token(tokens, token)
        keywords = metadata.get("keywords") or []
        for keyword in keywords:
            if not isinstance(keyword, str):
                continue
            phrase = keyword.strip().lower()
            if not phrase:
                continue
            keyword_phrases.add(phrase)
            for token in tokenize(phrase):
                incorporate_token(tokens, token)

        canonical = metadata.get("canonical")
        if isinstance(canonical, str):
            for token in tokenize_slug(canonical):
                incorporate_token(tokens, token)

        path_value = page.get("path")
        if isinstance(path_value, str):
            for token in tokenize_slug(path_value):
                incorporate_token(tokens, token)

        hero = page.get("hero") or {}
        for field in ("eyebrow", "heading", "subheading"):
            value = hero.get(field)
            if isinstance(value, str):
                for token in tokenize(value):
                    incorporate_token(tokens, token)

        features_section = page.get("featuresSection") or {}
        for field in ("heading", "subheading"):
            value = features_section.get(field)
            if isinstance(value, str):
                for token in tokenize(value):
                    incorporate_token(tokens, token)
        features = features_section.get("features") or []
        for feature in features:
            if not isinstance(feature, Mapping):
                continue
            for field in ("title", "description"):
                value = feature.get(field)
                if isinstance(value, str):
                    for token in tokenize(value):
                        incorporate_token(tokens, token)

        how_section = page.get("howItWorksSection") or {}
        for field in ("heading", "subheading"):
            value = how_section.get(field)
            if isinstance(value, str):
                for token in tokenize(value):
                    incorporate_token(tokens, token)
        steps = how_section.get("steps") or []
        for step in steps:
            if not isinstance(step, Mapping):
                continue
            for field in ("title", "description"):
                value = step.get(field)
                if isinstance(value, str):
                    for token in tokenize(value):
                        incorporate_token(tokens, token)

        seo_section = page.get("seoSection") or {}
        if isinstance(seo_section, Mapping):
            heading = seo_section.get("heading")
            if isinstance(heading, str):
                for token in tokenize(heading):
                    incorporate_token(tokens, token)
            body = seo_section.get("body")
            if isinstance(body, Sequence):
                tokens.update(extract_html_tokens(body))

        faq_section = page.get("faqSection") or {}
        for field in ("heading", "subheading"):
            value = faq_section.get(field)
            if isinstance(value, str):
                for token in tokenize(value):
                    incorporate_token(tokens, token)
        items = faq_section.get("items") or []
        for item in items:
            if not isinstance(item, Mapping):
                continue
            for field in ("question", "answer"):
                value = item.get(field)
                if isinstance(value, str):
                    for token in tokenize(value):
                        incorporate_token(tokens, token)

        related_section = page.get("relatedTopicsSection") or {}
        rel_heading = related_section.get("heading")
        if isinstance(rel_heading, str):
            for token in tokenize(rel_heading):
                incorporate_token(tokens, token)
        links = related_section.get("links") or []
        for link in links:
            if not isinstance(link, Mapping):
                continue
            for field in ("label", "description"):
                value = link.get(field)
                if isinstance(value, str):
                    for token in tokenize(value):
                        incorporate_token(tokens, token)

        linking = page.get("linkingRecommendations") or {}
        anchor_text = linking.get("anchorText")
        if isinstance(anchor_text, str):
            for token in tokenize(anchor_text):
                incorporate_token(tokens, token)
        description_variants = linking.get("descriptionVariants") or []
        for desc in description_variants:
            if isinstance(desc, str):
                for token in tokenize(desc):
                    incorporate_token(tokens, token)

        seo_embedded = page.get("embeddedFlashcards") or []
        for flashcard in seo_embedded:
            if not isinstance(flashcard, Mapping):
                continue
            for field in ("question", "answer"):
                value = flashcard.get(field)
                if isinstance(value, str):
                    for token in tokenize(value):
                        incorporate_token(tokens, token)

        contexts[slug] = PageContext(
            slug=slug,
            tokens=tokens,
            keyword_phrases=keyword_phrases,
            slug_tokens=slug_tokens,
        )

    return contexts


def build_subhub_contexts(
    taxonomy: Mapping[str, Mapping[str, Sequence[str]]],
    page_contexts: Mapping[str, PageContext],
    exclude_slugs: Optional[Set[str]] = None,
) -> Dict[Tuple[str, str], SubhubContext]:
    exclude_slugs = exclude_slugs or set()
    contexts: Dict[Tuple[str, str], SubhubContext] = {}

    for hub_name, subhubs in taxonomy.items():
        hub_tokens = set(tokenize(hub_name))

        for subhub_name, slugs in subhubs.items():
            key = (hub_name, subhub_name)
            name_tokens = set(hub_tokens)
            for token in tokenize(subhub_name):
                incorporate_token(name_tokens, token)

            tokens = set(name_tokens)
            keyword_phrases: Set[str] = set()
            slug_tokens: Set[str] = set()
            tracked_slugs: List[str] = []

            for slug in slugs:
                if slug in exclude_slugs:
                    continue
                tracked_slugs.append(slug)
                page_ctx = page_contexts.get(slug)
                if page_ctx:
                    tokens.update(page_ctx.tokens)
                    keyword_phrases.update(page_ctx.keyword_phrases)
                    slug_tokens.update(page_ctx.slug_tokens)
                else:
                    for token in tokenize_slug(slug):
                        incorporate_token(tokens, token)
                        slug_tokens.add(token)

            contexts[key] = SubhubContext(
                hub_name=hub_name,
                subhub_name=subhub_name,
                tokens=tokens,
                keyword_phrases=keyword_phrases,
                slug_tokens=slug_tokens,
                name_tokens=name_tokens,
                hub_tokens=hub_tokens,
                slugs=tracked_slugs,
            )

    return contexts


def jaccard_score(tokens_a: Iterable[str], tokens_b: Iterable[str]) -> float:
    set_a = set(tokens_a)
    set_b = set(tokens_b)
    if not set_a or not set_b:
        return 0.0
    intersection = set_a & set_b
    union = set_a | set_b
    if not union:
        return 0.0
    return len(intersection) / len(union)


def similarity(page_ctx: PageContext, subhub_ctx: SubhubContext) -> float:
    combined_slug_tokens = subhub_ctx.slug_tokens | subhub_ctx.name_tokens
    jaccard = jaccard_score(page_ctx.tokens, subhub_ctx.tokens)
    slug_overlap = len(page_ctx.slug_tokens & combined_slug_tokens)
    keyword_overlap = len(page_ctx.keyword_phrases & subhub_ctx.keyword_phrases)
    hub_overlap = len(page_ctx.slug_tokens & subhub_ctx.hub_tokens)

    return jaccard + 0.8 * keyword_overlap + 0.7 * slug_overlap + 0.3 * hub_overlap


def find_best_subhub(
    page_ctx: PageContext, contexts: Mapping[Tuple[str, str], SubhubContext]
) -> Tuple[Tuple[str, str], SubhubContext, float, float]:
    best_key: Optional[Tuple[str, str]] = None
    best_ctx: Optional[SubhubContext] = None
    best_score = float("-inf")
    runner_up_score = float("-inf")

    for key, ctx in contexts.items():
        score = similarity(page_ctx, ctx)
        if score > best_score:
            runner_up_score = best_score
            best_score = score
            best_key = key
            best_ctx = ctx
        elif score > runner_up_score:
            runner_up_score = score

    if best_key is None or best_ctx is None:
        raise ValueError(f"No subhub contexts available to assign slug {page_ctx.slug!r}")

    return best_key, best_ctx, best_score, runner_up_score


def add_page_to_context(subhub_ctx: SubhubContext, page_ctx: PageContext) -> None:
    subhub_ctx.slugs.append(page_ctx.slug)
    subhub_ctx.tokens.update(page_ctx.tokens)
    subhub_ctx.keyword_phrases.update(page_ctx.keyword_phrases)
    subhub_ctx.slug_tokens.update(page_ctx.slug_tokens)


def assign_missing_slugs(
    missing_slugs: Sequence[str],
    page_contexts: Mapping[str, PageContext],
    subhub_contexts: Dict[Tuple[str, str], SubhubContext],
    fallback_key: Tuple[str, str],
    min_confidence: float,
    ambiguous_confidence: float,
    gap_threshold: float,
    fallback_min_confidence: float,
) -> List[AssignmentResult]:
    assignments: List[AssignmentResult] = []

    if fallback_key not in subhub_contexts:
        raise ValueError(f"Fallback subhub {fallback_key!r} not found in taxonomy.")

    for slug in missing_slugs:
        page_ctx = page_contexts.get(slug)
        if not page_ctx:
            continue

        best_key, best_ctx, best_score, runner_up = find_best_subhub(page_ctx, subhub_contexts)
        gap = best_score - runner_up if runner_up != float("-inf") else best_score

        fallback_used = False
        reason = ""
        target_key = best_key

        if best_score < fallback_min_confidence:
            fallback_used = True
            target_key = fallback_key
            reason = (
                f"score {best_score:.3f} < fallback threshold {fallback_min_confidence:.3f}; "
                f"defaulting to {fallback_key[0]} → {fallback_key[1]}"
            )
        elif best_score < min_confidence:
            reason = f"score {best_score:.3f} below min confidence {min_confidence:.3f}"
        elif best_score < ambiguous_confidence and gap < gap_threshold:
            reason = f"score {best_score:.3f} with small gap {gap:.3f}"

        target_ctx = subhub_contexts[target_key]
        add_page_to_context(target_ctx, page_ctx)

        assignments.append(
            AssignmentResult(
                slug=slug,
                target_hub=target_key[0],
                target_subhub=target_key[1],
                score=best_score,
                runner_up=runner_up if runner_up != float("-inf") else 0.0,
                gap=gap,
                fallback_used=fallback_used,
                reason=reason,
                original_best=best_key if fallback_used else None,
            )
        )

    return assignments


def apply_assignments(
    taxonomy: MutableMapping[str, MutableMapping[str, List[str]]],
    assignments: Sequence[AssignmentResult],
) -> int:
    updates = 0
    for assignment in assignments:
        hub = taxonomy.get(assignment.target_hub)
        if hub is None:
            continue
        slugs = hub.get(assignment.target_subhub)
        if slugs is None:
            continue
        if assignment.slug not in slugs:
            slugs.append(assignment.slug)
            updates += 1
    return updates


def write_taxonomy(path: Path, taxonomy: Mapping[str, Mapping[str, Sequence[str]]]) -> None:
    payload = json.dumps(taxonomy, indent=2, ensure_ascii=False)
    path.write_text(f"{payload}\n", encoding="utf-8")


def collect_slugs(taxonomy: Mapping[str, Mapping[str, Sequence[str]]]) -> Set[str]:
    slugs: Set[str] = set()
    for subhubs in taxonomy.values():
        for items in subhubs.values():
            slugs.update(items)
    return slugs


def remove_slug_from_taxonomy(
    taxonomy: MutableMapping[str, MutableMapping[str, List[str]]], slug: str
) -> Optional[Tuple[str, str]]:
    for hub_name, subhubs in taxonomy.items():
        for subhub_name, items in subhubs.items():
            if slug in items:
                items.remove(slug)
                return hub_name, subhub_name
    return None


def find_low_confidence_entries(
    taxonomy: Mapping[str, Mapping[str, Sequence[str]]],
    page_contexts: Mapping[str, PageContext],
    min_confidence: float,
    ambiguous_confidence: float,
    gap_threshold: float,
    restrict_slugs: Optional[Set[str]] = None,
    fallback_key: Optional[Tuple[str, str]] = None,
) -> List[LowConfidenceEntry]:
    results: List[LowConfidenceEntry] = []

    for hub_name, subhubs in taxonomy.items():
        for subhub_name, slugs in subhubs.items():
            for slug in slugs:
                if restrict_slugs and slug not in restrict_slugs:
                    continue
                page_ctx = page_contexts.get(slug)
                if not page_ctx:
                    continue

                contexts = build_subhub_contexts(
                    taxonomy, page_contexts, exclude_slugs={slug}
                )
                best_key, _, best_score, runner_up = find_best_subhub(page_ctx, contexts)
                gap = best_score - runner_up if runner_up != float("-inf") else best_score

                actual_key = (hub_name, subhub_name)
                if fallback_key and actual_key == fallback_key:
                    continue

                reason: Optional[str] = None
                if best_score < min_confidence and best_key != actual_key:
                    reason = f"score {best_score:.3f} below min confidence {min_confidence:.3f}"
                elif (
                    best_score < ambiguous_confidence
                    and gap < gap_threshold
                    and best_key != actual_key
                ):
                    reason = f"score {best_score:.3f} with small gap {gap:.3f}"

                if reason:
                    results.append(
                        LowConfidenceEntry(
                            slug=slug,
                            hub=hub_name,
                            subhub=subhub_name,
                            score=best_score,
                            runner_up=runner_up if runner_up != float("-inf") else 0.0,
                            gap=gap,
                            best_key=best_key,
                            reason=reason,
                        )
                    )

    results.sort(key=lambda entry: (entry.score, entry.gap))
    return results


def load_baseline_slugs(path: Optional[Path]) -> Set[str]:
    if not path:
        return set()
    if not path.exists():
        raise FileNotFoundError(f"Baseline taxonomy {path} does not exist.")
    data = load_taxonomy(path)
    return collect_slugs(data)


def summarise_assignments(assignments: Sequence[AssignmentResult]) -> None:
    if not assignments:
        print("No assignments generated.")
        return

    fallback_count = sum(1 for item in assignments if item.fallback_used)
    low_confidence = [item for item in assignments if item.reason and not item.fallback_used]

    print(f"Prepared {len(assignments)} taxonomy assignments.")
    print(
        f"  Score range: {min(item.score for item in assignments):.4f}"
        f" → {max(item.score for item in assignments):.4f}"
    )
    if fallback_count:
        print(f"  Fallback assignments: {fallback_count}")
    if low_confidence:
        preview = ", ".join(
            f"{item.slug}→{item.target_subhub} ({item.score:.3f})" for item in low_confidence[:10]
        )
        print(
            f"  Review recommended for {len(low_confidence)} assignments"
            f" (examples: {preview})"
        )


def format_low_confidence(entry: LowConfidenceEntry) -> str:
    best_hub, best_subhub = entry.best_key
    return (
        f"{entry.slug}: {entry.hub} → {entry.subhub} | score={entry.score:.3f} "
        f"gap={entry.gap:.3f} | best candidate {best_hub} → {best_subhub} | {entry.reason}"
    )


def write_low_confidence_report(path: Path, entries: Sequence[LowConfidenceEntry]) -> None:
    payload = [
        {
            "slug": entry.slug,
            "currentHub": entry.hub,
            "currentSubhub": entry.subhub,
            "score": entry.score,
            "runnerUpScore": entry.runner_up,
            "gap": entry.gap,
            "bestHub": entry.best_key[0],
            "bestSubhub": entry.best_key[1],
            "reason": entry.reason,
        }
        for entry in entries
    ]
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote low-confidence report to {path}")


def main() -> None:
    args = parse_arguments()

    _, _, _, pages = load_pages(args.pages)
    page_contexts = build_page_contexts(pages)
    taxonomy = load_taxonomy(args.taxonomy)

    baseline_slugs = load_baseline_slugs(args.baseline_taxonomy)
    assigned_slugs = collect_slugs(taxonomy)
    generated_slugs = {page.get("slug") for page in pages if page.get("slug")}

    missing_slugs = sorted(generated_slugs - assigned_slugs)

    if args.limit is not None:
        missing_slugs = missing_slugs[: args.limit]

    fallback_key = (args.fallback_hub, args.fallback_subhub)
    if args.fallback_hub not in taxonomy:
        raise KeyError(f"Fallback hub {args.fallback_hub!r} not found in taxonomy.")
    if args.fallback_subhub not in taxonomy[args.fallback_hub]:
        raise KeyError(
            f"Fallback subhub {args.fallback_subhub!r} not found under hub {args.fallback_hub!r}."
        )

    restrict_slugs = None
    if baseline_slugs:
        restrict_slugs = assigned_slugs - baseline_slugs

    if args.report_existing or args.reassign_low_confidence:
        low_confidence_entries = find_low_confidence_entries(
            taxonomy,
            page_contexts,
            args.min_confidence,
            args.ambiguous_confidence,
            args.gap_threshold,
            restrict_slugs=restrict_slugs,
            fallback_key=fallback_key,
        )

        if args.report_existing:
            if not low_confidence_entries:
                print("No low-confidence assignments detected.")
            else:
                print(f"Detected {len(low_confidence_entries)} low-confidence assignments:")
                for entry in low_confidence_entries[:50]:
                    print(f"  - {format_low_confidence(entry)}")
                if args.report_output:
                    write_low_confidence_report(args.report_output, low_confidence_entries)
            return

        if low_confidence_entries:
            print(
                f"Identified {len(low_confidence_entries)} existing assignments below confidence"
                " thresholds; they will be reassigned."
            )
            for entry in low_confidence_entries:
                removed = remove_slug_from_taxonomy(taxonomy, entry.slug)
                if removed:
                    missing_slugs.append(entry.slug)
        else:
            print("No low-confidence assignments found; nothing to reassign.")

    missing_slugs = sorted(set(missing_slugs))

    if not missing_slugs:
        print("All generated flashcard pages already belong to a subhub.")
        return

    subhub_contexts = build_subhub_contexts(taxonomy, page_contexts)

    assignments = assign_missing_slugs(
        missing_slugs,
        page_contexts,
        subhub_contexts,
        fallback_key=fallback_key,
        min_confidence=args.min_confidence,
        ambiguous_confidence=args.ambiguous_confidence,
        gap_threshold=args.gap_threshold,
        fallback_min_confidence=args.fallback_min_confidence,
    )

    summarise_assignments(assignments)

    if args.dry_run:
        print("Dry run enabled; taxonomy file was not modified.")
        return

    updates = apply_assignments(taxonomy, assignments)
    if updates:
        write_taxonomy(args.taxonomy, taxonomy)
        print(f"Wrote {updates} new assignments to {args.taxonomy}.")
    else:
        print("Assignments matched existing taxonomy; no filesystem changes made.")


if __name__ == "__main__":
    main()
