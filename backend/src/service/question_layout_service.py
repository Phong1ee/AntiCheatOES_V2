"""Canonical deterministic layout for attempt creation and teacher previews.

Positions are one-based answer slots; page gaps are explicit when keeping a
block together. Pins are validated after pagination, never silently displaced.
"""
import hashlib
import random


def build_layout(question_ids, members=None, blocks=None, questions_per_page=1, shuffle=False, seed="0"):
    if not 1 <= questions_per_page <= 50:
        raise ValueError("questions_per_page must be between 1 and 50")
    ids = list(question_ids)
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate question in layout")
    members = members or {}
    blocks = blocks or {}
    rng = random.Random(int.from_bytes(hashlib.sha256(str(seed).encode()).digest(), "big"))
    logical, seen = [], set()
    for qid in ids:
        member = members.get(qid, {})
        bid = member.get("block_id")
        key = ("block", bid) if bid is not None else ("question", qid)
        if key in seen:
            continue
        seen.add(key)
        block = dict(blocks.get(bid, {})) if bid is not None else {}
        children = [q for q in ids if members.get(q, {}).get("block_id") == bid] if bid is not None else [qid]
        children.sort(key=lambda q: (members.get(q, {}).get("structure_order", 0), q))
        if bid is not None and any(members.get(q, {}).get("pinned_position") is not None or members.get(q, {}).get("pinned_page") is not None for q in children):
            raise ValueError("Pin the logical block instead of a child within it")
        if shuffle and bid is not None and not block.get("keep_order", True):
            rng.shuffle(children)
        logical.append({"children": children, "block": block if bid is not None else None,
                        "pin": block.get("pinned_position") if bid is not None else member.get("pinned_position"),
                        "page_pin": block.get("pinned_page") if bid is not None else member.get("pinned_page"),
                        "order": block.get("structure_order", 0) if bid is not None else member.get("structure_order", 0)})
    logical.sort(key=lambda b: (b["order"], ids.index(b["children"][0])))
    if any(b["page_pin"] is not None for b in logical):
        return _page_layout(logical, questions_per_page, shuffle, rng)
    pinned = [b for b in logical if b["pin"] is not None]
    free = [b for b in logical if b["pin"] is None]
    if shuffle:
        rng.shuffle(free)
    occupied = {}

    def fits(block, start):
        length = len(block["children"])
        if block["block"] and block["block"].get("keep_together", True) and length <= questions_per_page:
            if (start % questions_per_page) + length > questions_per_page:
                return False
        return all(i not in occupied for i in range(start, start + length))

    def place(block, start):
        for i, qid in enumerate(block["children"]):
            occupied[start + i] = (qid, block)

    capacity = len(ids) + len(logical) * (questions_per_page - 1)
    for block in sorted(pinned, key=lambda b: b["pin"]):
        start = block["pin"] - 1
        if start < 0 or start + len(block["children"]) > max(capacity, 1) or not fits(block, start):
            raise ValueError("Pinned position conflicts with another block or page boundary")
        place(block, start)
    for block in free:
        start = 0
        while not fits(block, start):
            start += 1
            if start > capacity:
                raise ValueError("No legal layout slots remain")
        place(block, start)
    # Don't create inaccessible empty pages from a pin with no preceding content.
    used_pages = {i // questions_per_page for i in occupied}
    if used_pages and used_pages != set(range(max(used_pages) + 1)):
        raise ValueError("Pinned position creates an empty page")
    result = []
    for order, (position, (qid, block)) in enumerate(sorted(occupied.items()), 1):
        page = position // questions_per_page + 1
        first = block["children"][0]
        first_position = next(i for i, (q, _) in occupied.items() if q == first)
        result.append({"question_id": qid, "display_order": order, "position": position + 1,
                       "page": page, "slot": position % questions_per_page + 1,
                       "questions_per_page": questions_per_page, "block": block["block"],
                       "continuation": page > first_position // questions_per_page + 1})
    return result


def _page_layout(logical, per_page, shuffle, rng):
    """Explicit pins share their page; other pages use the exam's default size."""
    count = sum(len(block["children"]) for block in logical)
    if any(block["pin"] is not None and block["page_pin"] is None for block in logical):
        raise ValueError("Use page pins consistently; clear legacy global position pins first")
    pinned = [b for b in logical if b["page_pin"] is not None]
    free = [b for b in logical if b["page_pin"] is None]
    if shuffle:
        rng.shuffle(free)
    capacities = {}
    for block in pinned:
        page = block["page_pin"]
        if not isinstance(page, int) or isinstance(page, bool) or not 1 <= page <= max(count, 1):
            raise ValueError("Pinned page is out of range or would create empty pages")
        capacities[page] = capacities.get(page, 0) + min(len(block["children"]), 50)
    if any(value > 50 for value in capacities.values()):
        raise ValueError("A pinned page cannot contain more than 50 questions")
    capacities = {page: max(per_page, size) for page, size in capacities.items()}
    # Finite slots also guarantee oversized blocks terminate and split safely.
    slots = [(page, slot) for page in range(1, count + len(logical) + 1)
             for slot in range(1, capacities.get(page, per_page) + 1)]
    occupied = {}

    def fits(block, start):
        size = len(block["children"])
        if start + size > len(slots) or any(i in occupied for i in range(start, start + size)):
            return False
        if block["block"] and block["block"].get("keep_together", True) and size <= per_page:
            return slots[start][0] == slots[start + size - 1][0]
        return True

    def place(block, candidates):
        for start in candidates:
            if fits(block, start):
                for offset, qid in enumerate(block["children"]):
                    occupied[start + offset] = (qid, block)
                return
        raise ValueError("Pinned page conflicts with a block; move the block or increase questions per page")

    for block in sorted(pinned, key=lambda b: (b["page_pin"], b["order"])):
        place(block, (i for i, (page, _) in enumerate(slots) if page == block["page_pin"]))
    for block in free:
        place(block, range(len(slots)))
    pages = {slots[i][0] for i in occupied}
    if pages and pages != set(range(1, max(pages) + 1)):
        raise ValueError("Pinned page creates an empty page; choose an earlier page")
    result = []
    for order, (index, (qid, block)) in enumerate(sorted(occupied.items()), 1):
        page, slot = slots[index]
        first_index = next(i for i, (q, b) in occupied.items() if b is block)
        result.append({"question_id": qid, "display_order": order, "position": index + 1,
                       "page": page, "slot": slot, "questions_per_page": per_page,
                       "block": block["block"], "continuation": page > slots[first_index][0]})
    return result
