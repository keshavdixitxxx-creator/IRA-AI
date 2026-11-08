"""IRA Office agent roles and deterministic boss delegation.

The boss planner is intentionally rule-based and reported as such. Agent execution
uses the same Ollama-first brain pipeline as the rest of IRA.
"""

from __future__ import annotations

import re

AGENTS = {
    "atlas": {
        "name": "Atlas", "title": "Research Lead", "app": "research",
        "prompt": "You are Atlas, IRA Office's research lead. Produce a factual, structured research brief. Do not invent sources, citations, or live access. Clearly separate established facts from uncertainty.",
    },
    "pixel": {
        "name": "Pixel", "title": "Senior Coder", "app": "code",
        "prompt": "You are Pixel, IRA Office's senior software engineer. Write complete, practical, production-minded code for the requested language. Return code first, with concise explanation only when useful. Do not claim you ran or tested it.",
    },
    "worden": {
        "name": "Worden", "title": "Document Writer", "app": "word",
        "prompt": "You are Worden, IRA Office's professional document writer. Draft polished document content with a clear title, section headings, and paragraphs. Return the document content only; the host application will create the DOCX file.",
    },
    "grid": {
        "name": "Grid", "title": "Data Analyst", "app": "excel",
        "prompt": "You are Grid, IRA Office's data analyst. Create a useful table for the request. Return only valid CSV with a header row and consistent columns, without a code fence or commentary. Never invent that the values are real measurements; use plausible example labels when data is not supplied.",
    },
    "slides": {
        "name": "Slides", "title": "Presentation Designer", "app": "powerpoint",
        "prompt": "You are Slides, IRA Office's presentation designer. Create exactly five concise slides. Format each as 'Slide: descriptive title' followed by three to five '- bullet' lines. Return slides only, without an introduction or code fence.",
    },
    "scout": {
        "name": "Scout", "title": "Web Investigator", "app": "browser",
        "prompt": "You are Scout, IRA Office's web investigator. Identify the best research path and reliable public sources for the request. Never pretend you opened a link. Provide a concise source-finding brief and only URLs you are confident are valid.",
    },
    "sage": {
        "name": "Sage", "title": "Whiteboard Analyst", "app": "whiteboard",
        "prompt": "You are Sage, IRA Office's fact checker and whiteboard analyst. Turn factual risks, assumptions, evidence, and verification steps into three to six short whiteboard sticky notes. Return one '- concise note' per line, without an introduction. Do not invent citations.",
    },
    "byte": {
        "name": "Byte", "title": "QA Engineer", "app": "code",
        "prompt": "You are Byte, IRA Office's QA engineer sharing Pixel's code workspace. Produce a focused review or test plan for the requested software. Include concrete edge cases and example tests, but do not claim tests were executed. The host places your answer in the qa-review.md editor tab.",
    },
    "archie": {
        "name": "Archie", "title": "OneNote Curator", "app": "onenote",
        "prompt": "You are Archie, IRA Office's file manager and OneNote curator. Turn the request into an organized notebook page with a '# Page title', clear sections, actionable notes, and useful filing names. Return the page content only; the host creates a new shared notebook page.",
    },
    "echo": {
        "name": "Echo", "title": "Classroom Coordinator", "app": "classroom",
        "prompt": "You are Echo, IRA Office's knowledge curator and classroom coordinator. Create a local classroom announcement, lesson, or assignment with a clear title, concise instructions, learning goals, and due-date suggestions when requested. Return the class post only. Never claim it was synchronized to Google Classroom.",
    },
}


def role_prompt(agent: str) -> str:
    return AGENTS.get(agent, AGENTS["atlas"])["prompt"]


def agent_public(agent: str) -> dict:
    found = AGENTS.get(agent, AGENTS["atlas"])
    return {"id": agent if agent in AGENTS else "atlas", **{k: v for k, v in found.items() if k != "prompt"}}


def _task(agent: str, text: str) -> dict:
    return {"agent": agent, "task": text, **agent_public(agent)}


def plan_office(goal: str) -> list[dict]:
    """Assign relevant specialists to a user goal; at most five concurrent jobs."""
    goal = " ".join((goal or "").split())[:4000]
    lowered = goal.lower()
    plan: list[dict] = []

    def matches(pattern: str) -> bool:
        return bool(re.search(pattern, lowered))

    if matches(r"research|analy[sz]e|investigate|explain|learn|compare|market|current|news|fact"):
        plan.append(_task("atlas", f"Research this objective and return a grounded brief: {goal}"))
    if matches(r"\b(code|coding|program|script|function|software|app|application|api|website|debug|python|javascript)\b"):
        plan.append(_task("pixel", f"Implement the software portion of this objective: {goal}"))
    if matches(r"\b(word|docx|document|report|letter|essay|proposal)\b"):
        plan.append(_task("worden", f"Draft a professional document for this objective: {goal}"))
    if matches(r"\b(excel|xlsx|spreadsheet|worksheet|csv|table|budget|sales data|data set)\b"):
        plan.append(_task("grid", f"Create the spreadsheet table for this objective: {goal}"))
    if matches(r"\b(powerpoint|pptx|presentation|slides|slide deck|pitch deck)\b"):
        plan.append(_task("slides", f"Create a five-slide presentation for this objective: {goal}"))
    if matches(r"\b(onenote|one note|notebook|note book|journal|notes)\b"):
        plan.append(_task("archie", f"Create an organized shared notebook page for this objective: {goal}"))
    if matches(r"\b(whiteboard|white board|brainstorm|mind map|mindmap|affirmative map)\b"):
        plan.append(_task("sage", f"Turn this objective into a concise analytical whiteboard: {goal}"))
    if matches(r"\b(classroom|class room|course|lesson|teach|student|students|classwork|homework)\b"):
        plan.append(_task("echo", f"Create a local classroom post or lesson for this objective: {goal}"))
    if len(plan) and any(task["app"] == "code" for task in plan):
        plan.append(_task("byte", f"Prepare QA checks and edge-case tests for this software objective: {goal}"))
    if matches(r"\b(browse|browser|sources|links|websites|url)\b") and len(plan) < 4:
        plan.append(_task("scout", f"Identify reliable public sources and a browsing plan for: {goal}"))
    if not plan:
        plan.append(_task("atlas", f"Research and develop a useful response to this objective: {goal}"))
        plan.append(_task("archie", f"Create a concise shared notebook page and next-step outline for: {goal}"))
    if len(plan) > 1 and len(plan) < 4 and matches(r"important|accurate|reliable|verify|fact"):
        plan.append(_task("sage", f"List factual risks and verification steps for: {goal}"))
    return plan[:5]
