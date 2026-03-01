"""
Research MCP Server
───────────────────
A Model Context Protocol server that provides free research tools:
  • Web search (DuckDuckGo)
  • URL content extraction
  • arXiv paper search
  • Wikipedia lookup
  • Text summarization

No API keys required. All endpoints are public and free.

Usage:
  python server.py            # Start MCP server (stdio transport)
"""

from __future__ import annotations

import re
import textwrap
import xml.etree.ElementTree as ET
from urllib.parse import quote_plus

import httpx
from bs4 import BeautifulSoup
from markdownify import markdownify as md
from mcp.server.fastmcp import FastMCP

# ── Server ────────────────────────────────────────────────────────────────────

mcp = FastMCP(
    "research",
    version="1.0.0",
    description="Research tools: web search, URL scraping, arXiv, Wikipedia, summarization",
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}

TIMEOUT = httpx.Timeout(30.0)


# ── Tool 1: Web Search (DuckDuckGo HTML) ─────────────────────────────────────


@mcp.tool()
async def search_web(query: str, max_results: int = 8) -> str:
    """
    Search the web using DuckDuckGo and return results.

    Args:
        query: The search query string.
        max_results: Maximum number of results to return (default 8, max 20).
    """
    max_results = min(max_results, 20)
    url = "https://html.duckduckgo.com/html/"
    data = {"q": query}

    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        resp = await client.post(url, data=data, headers=HEADERS)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    results = []

    for i, result_div in enumerate(soup.select(".result")):
        if i >= max_results:
            break

        title_tag = result_div.select_one(".result__a")
        snippet_tag = result_div.select_one(".result__snippet")
        url_tag = result_div.select_one(".result__url")

        title = title_tag.get_text(strip=True) if title_tag else "No title"
        snippet = snippet_tag.get_text(strip=True) if snippet_tag else ""
        link = url_tag.get_text(strip=True) if url_tag else ""

        results.append(f"### {i + 1}. {title}\n**URL**: {link}\n{snippet}")

    if not results:
        return f"No results found for: {query}"

    return f"## Search Results for: {query}\n\n" + "\n\n---\n\n".join(results)


# ── Tool 2: Fetch URL Content ────────────────────────────────────────────────


@mcp.tool()
async def fetch_url(url: str, max_length: int = 8000) -> str:
    """
    Fetch a URL and extract its main text content as Markdown.

    Args:
        url: The URL to fetch content from.
        max_length: Maximum character length of the returned content (default 8000).
    """
    async with httpx.AsyncClient(timeout=TIMEOUT, follow_redirects=True) as client:
        resp = await client.get(url, headers=HEADERS)
        resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove script, style, nav, footer, header elements
    for tag in soup(["script", "style", "nav", "footer", "header", "aside", "iframe"]):
        tag.decompose()

    # Try to find the main content area
    main = (
        soup.find("main")
        or soup.find("article")
        or soup.find("div", {"role": "main"})
        or soup.find("div", class_=re.compile(r"content|article|post|entry", re.I))
        or soup.body
    )

    if not main:
        return "Could not extract content from this URL."

    # Convert to markdown
    content = md(str(main), heading_style="ATX", strip=["img"]).strip()

    # Clean up excessive whitespace
    content = re.sub(r"\n{3,}", "\n\n", content)

    if len(content) > max_length:
        content = content[:max_length] + "\n\n... [content truncated]"

    title = soup.title.get_text(strip=True) if soup.title else url
    return f"## {title}\n**Source**: {url}\n\n{content}"


# ── Tool 3: arXiv Paper Search ───────────────────────────────────────────────


@mcp.tool()
async def search_arxiv(
    query: str, max_results: int = 5, sort_by: str = "relevance"
) -> str:
    """
    Search arXiv for academic papers.

    Args:
        query: Search keywords (e.g. "distributed file systems erasure coding").
        max_results: Number of papers to return (default 5, max 15).
        sort_by: Sort order — "relevance" (default) or "date".
    """
    max_results = min(max_results, 15)
    sort_param = "lastUpdatedDate" if sort_by == "date" else "relevance"
    encoded_query = quote_plus(query)

    api_url = (
        f"http://export.arxiv.org/api/query"
        f"?search_query=all:{encoded_query}"
        f"&start=0&max_results={max_results}"
        f"&sortBy={sort_param}&sortOrder=descending"
    )

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        resp = await client.get(api_url)
        resp.raise_for_status()

    root = ET.fromstring(resp.text)
    ns = {"atom": "http://www.w3.org/2005/Atom"}

    entries = root.findall("atom:entry", ns)
    if not entries:
        return f"No arXiv papers found for: {query}"

    results = []
    for i, entry in enumerate(entries):
        title = entry.findtext("atom:title", "", ns).strip().replace("\n", " ")
        summary = entry.findtext("atom:summary", "", ns).strip()
        published = entry.findtext("atom:published", "", ns)[:10]

        authors = [
            a.findtext("atom:name", "", ns)
            for a in entry.findall("atom:author", ns)
        ]
        author_str = ", ".join(authors[:4])
        if len(authors) > 4:
            author_str += f" (+{len(authors) - 4} more)"

        # Get the arXiv link
        link = ""
        for l in entry.findall("atom:link", ns):
            if l.get("type") == "text/html":
                link = l.get("href", "")
                break

        # Get PDF link
        pdf_link = ""
        for l in entry.findall("atom:link", ns):
            if l.get("title") == "pdf":
                pdf_link = l.get("href", "")
                break

        # Truncate summary
        if len(summary) > 400:
            summary = summary[:400] + "..."

        paper = (
            f"### {i + 1}. {title}\n"
            f"**Authors**: {author_str}\n"
            f"**Published**: {published}\n"
            f"**Link**: {link}\n"
        )
        if pdf_link:
            paper += f"**PDF**: {pdf_link}\n"
        paper += f"\n{summary}"

        results.append(paper)

    return f"## arXiv Results for: {query}\n\n" + "\n\n---\n\n".join(results)


# ── Tool 4: Wikipedia Lookup ─────────────────────────────────────────────────


@mcp.tool()
async def search_wikipedia(query: str, sentences: int = 5) -> str:
    """
    Look up a topic on Wikipedia and return a summary.

    Args:
        query: The topic to search for.
        sentences: Number of sentences in the summary (default 5, max 15).
    """
    sentences = min(sentences, 15)

    # Step 1: Search for the best matching page
    search_url = (
        f"https://en.wikipedia.org/w/api.php"
        f"?action=query&list=search&srsearch={quote_plus(query)}"
        f"&srlimit=1&format=json"
    )

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        search_resp = await client.get(search_url, headers=HEADERS)
        search_resp.raise_for_status()
        search_data = search_resp.json()

    results = search_data.get("query", {}).get("search", [])
    if not results:
        return f"No Wikipedia article found for: {query}"

    page_title = results[0]["title"]

    # Step 2: Get the page summary
    summary_url = (
        f"https://en.wikipedia.org/w/api.php"
        f"?action=query&prop=extracts&exintro&explaintext"
        f"&exsentences={sentences}&titles={quote_plus(page_title)}"
        f"&format=json"
    )

    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        summary_resp = await client.get(summary_url, headers=HEADERS)
        summary_resp.raise_for_status()
        summary_data = summary_resp.json()

    pages = summary_data.get("query", {}).get("pages", {})
    page = next(iter(pages.values()), {})
    extract = page.get("extract", "No summary available.")

    wiki_url = f"https://en.wikipedia.org/wiki/{quote_plus(page_title.replace(' ', '_'))}"

    return (
        f"## {page_title}\n"
        f"**Source**: {wiki_url}\n\n"
        f"{extract}"
    )


# ── Tool 5: Text Summarization ───────────────────────────────────────────────


@mcp.tool()
async def summarize_text(text: str, style: str = "bullets") -> str:
    """
    Summarize a block of text into key points. Uses extractive summarization
    (sentence scoring based on word frequency).

    Args:
        text: The text to summarize.
        style: Output style — "bullets" (default) or "paragraph".
    """
    if len(text) < 100:
        return text

    # Simple extractive summarization via sentence scoring
    sentences = re.split(r"(?<=[.!?])\s+", text.strip())
    if len(sentences) <= 3:
        return text

    # Score words by frequency
    words = re.findall(r"\b[a-zA-Z]{3,}\b", text.lower())
    stop_words = {
        "the", "and", "for", "are", "but", "not", "you", "all", "can",
        "had", "her", "was", "one", "our", "out", "has", "have", "been",
        "this", "that", "with", "from", "they", "will", "would", "there",
        "their", "what", "about", "which", "when", "make", "like", "than",
        "each", "other", "into", "could", "more", "some", "very", "just",
        "also", "should", "these", "those", "then", "them", "here",
    }
    word_freq: dict[str, int] = {}
    for w in words:
        if w not in stop_words:
            word_freq[w] = word_freq.get(w, 0) + 1

    if not word_freq:
        return text

    max_freq = max(word_freq.values())
    word_scores = {w: f / max_freq for w, f in word_freq.items()}

    # Score each sentence
    scored: list[tuple[float, int, str]] = []
    for idx, sent in enumerate(sentences):
        sent_words = re.findall(r"\b[a-zA-Z]{3,}\b", sent.lower())
        if not sent_words:
            continue
        score = sum(word_scores.get(w, 0) for w in sent_words) / len(sent_words)
        scored.append((score, idx, sent.strip()))

    # Pick top sentences (keep ~30% or at least 3)
    n_keep = max(3, len(scored) // 3)
    top_sentences = sorted(scored, key=lambda x: x[0], reverse=True)[:n_keep]
    # Restore original order
    top_sentences.sort(key=lambda x: x[1])

    if style == "paragraph":
        return " ".join(s[2] for s in top_sentences)

    # Bullets
    bullets = "\n".join(f"- {s[2]}" for s in top_sentences)
    return f"## Summary ({len(top_sentences)} key points)\n\n{bullets}"


# ── Main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mcp.run()
